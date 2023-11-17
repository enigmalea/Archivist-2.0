import {
  getUserProfileUrl,
  getWorkDetailsFromUrl,
} from "@bobaboard/ao3.js/urls";

import { ColorResolvable } from "discord.js";
import dayjs from "dayjs";
import { getWork } from "@bobaboard/ao3.js";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Creates the author links for the work.
export const allAuthors = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let workAuthors;
  if (work.locked) {
    return "";
  } else {
    switch (work.authors) {
      case "Anonymous":
        workAuthors = "Anonymous";
        break;

      default:
        let authorsArray = [];
        let display;
        let username;
        let url;

        for (let i in work.authors) {
          display = work.authors[i].pseud;
          username = work.authors[i].username;
          url = getUserProfileUrl({ username: username });
        }

        let author = `[${display}](${url})`;
        authorsArray.push(author);

        workAuthors = authorsArray.join(", ");
        break;
    }
  }
  return workAuthors;
};

// Creates the chapter display for the work.
export const chapterDisplay = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let workChapters;
  if (work.locked) {
    return "";
  } else {
    switch (work.chapters.total) {
      case null:
        workChapters = `${work.chapters.published}/?`;
        break;
      default:
        workChapters = `${work.chapters.published}/${work.chapters.total}`;
        break;
    }
  }
  return workChapters;
};

// Displays the last updated date for the work.
export const lastUpdated = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let updated;
  if (work.locked) {
    return "";
  } else {
    switch (work.updatedAt) {
      case null:
        updated = `N/A`;
        break;
      default:
        updated = dayjs(work.updatedAt).format("ll");
        break;
    }
  }
  return updated;
};

// Shows the completion status for the work.
export const workStatus = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let status;
  if (work.locked) {
    return "";
  } else {
    switch (work.complete) {
      case true:
        status = "Complete";
        break;
      case false:
        status = "Work in Progress";
        break;
    }
  }
  return status;
};

// Define the rating icon based on the work rating.
export const ratingIcon = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

	let ratingImage!: string;
  if (work.locked) {
    return "";
  } else {
    switch (work.rating) {
      case "Not Rated":
          ratingImage="<:notrated:866825856236519426>";
        break;

      case "General Audiences":
          ratingImage="<:general:866823809180631040>";
        break;

      case "Teen And Up Audiences":
          ratingImage="<:teen:866823893015330826>";
        break;

      case "Mature":
          ratingImage="<:mature:866823956684996628>";
        break;

      case "Explicit":
          ratingImage="<:explicit:866824069050269736>";
        break;
    }
    return ratingImage;
  }
};

// Define the embed color based on the work rating.
export const embedColor = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

	let color!: any;
  if (work.locked) {
    return "";
  } else {
    switch (work.rating) {
      case "Not Rated":
          color=0xffffff;
        break;

      case "General Audiences":
          color=0x77a50e;
        break;

      case "Teen And Up Audiences":
          color=0xe8d506;
        break;

      case "Mature":
          color=0xde7e28;
        break;

      case "Explicit":
          color=0x9c0000;
        break;
    }
    return color;
  }
};