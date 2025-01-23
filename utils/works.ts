import {
  getUserProfileUrl,
  getWorkDetailsFromUrl,
} from "@bobaboard/ao3.js/urls";

import dayjs from "dayjs";
import { getWork } from "@bobaboard/ao3.js";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Extends dayjs to offer localized date formats.
dayjs.extend(localizedFormat);

// Creates the author links for the work.
export const allAuthors = async (workURL: string) => {
  // Defines the work variable from the url the user input.
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let workAuthors;
  // Verifies if the work is locked to AO3 users. If so, it returns nothing.
  if (work.locked) {
    return;
  } else {
    // If the work is not locked, begins to construct the author links.
    switch (work.authors[0].anonymous) {
      case true:
        workAuthors = "Anonymous";
        break;

      // Default for the switch case assumes authors are not anonymous.
      default:
        // Constructs variables which are accessible outside of the loop.
        let authorsArray = [];
        // For each author in the array, we define their display name (pseud), username (actual AO3 username), and their url.
        for (let i in work.authors) {
          const display = work.authors[i].pseud;
          const username = work.authors[i].username;
          const url = getUserProfileUrl({ username: username });

          // Construct a new array consisting of a markdown formatted masked link of their display name and url.
          const author = `[${display}](${url})`;
          authorsArray.push(author);
        }

        // Join the array of markdown links with commas to create a string for display.
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
    return;
  } else {
    switch (work.rating) {
      case "Not Rated":
        ratingImage = "<:notrated:866825856236519426>";
        break;

      case "General Audiences":
        ratingImage = "<:general:866823809180631040>";
        break;

      case "Teen And Up Audiences":
        ratingImage = "<:teen:866823893015330826>";
        break;

      case "Mature":
        ratingImage = "<:mature:866823956684996628>";
        break;

      case "Explicit":
        ratingImage = "<:explicit:866824069050269736>";
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
        color = 0xffffff;
        break;

      case "General Audiences":
        color = 0x77a50e;
        break;

      case "Teen And Up Audiences":
        color = 0xe8d506;
        break;

      case "Mature":
        color = 0xde7e28;
        break;

      case "Explicit":
        color = 0x9c0000;
        break;
    }
    return color;
  }
};

// Formats the category for a work-related embed.
export const workCategory = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let allCategories;
  if (work.locked) {
    return "";
  } else {
    switch (work.category) {
      case null:
        allCategories = `N/A`;
        break;
      default:
        allCategories = work.category.join(", ");
        break;
    }
  }
  return allCategories;
};

export const workSeries = async (workUrl: string) => {
  const workId = getWorkDetailsFromUrl({ url: workUrl }).workId;
  const work = await getWork({ workId: workId });

  let formattedSeries;
  if (work.locked) {
    return;
  } else {
    switch (work.series.length) {
      case 0:
        formattedSeries = "";
        break;
      case 1:
        let series = `[${work.series[0].name}](https://archiveofourown.org/series/${work.series[0].id})`;
        formattedSeries = `**Series:** ${series}`;
        break;
      default:
        let allSeries = [];
        for (let i in work.series) {
          let seriesLink = `[${work.series[i].name}](https://archiveofourown.org/series/${work.series[i].id});`;
          allSeries.push(seriesLink);
          series = allSeries.join(", ");
          formattedSeries = `**Series:** ${series}`;
        }
    }
  }
  return formattedSeries;
};

// Formats the summary for a work-related embed.
export const workSummary = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  let formattedSummary;
  if (work.locked) {
    return;
  } else {
    switch (work.category) {
      case null:
        formattedSummary = `N/A`;
        break;
      default:
        formattedSummary = work.summary!;
        break;
    }
  }
  return formattedSummary;
};
