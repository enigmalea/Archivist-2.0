import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat.js";

// Extends dayjs to offer localized date formats.
dayjs.extend(localizedFormat);

// Published date for works
export function publishedDate(work: any): string {
  if (work?.locked) {
    return "";
  } else {return dayjs(work.publishedAt).format("ll")};
}

// Published date for series.
export function startedDate(series: any): string {
  return dayjs(series.startedAt).format("ll");
}

// Updated date for both works & series.
type UpdatedAtSource = {
  locked?: boolean;
  updatedAt?: string | Date | null;
};

export function updatedAt(
  item: UpdatedAtSource | null
): string {
  if (!item || item.locked) {
    return "";
  }

  if (!item.updatedAt) {
    return "N/A";
  }

  return dayjs(item.updatedAt).format("ll");
}

// Shows how many chapters out of the expected number of chapters have been posted.
export function chapterDisplay(work: any): string {
	let workChapters;
  if (work?.locked) {
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


// Formats the completion status for work & series.
type CompletionStatusSource = {
  locked?: boolean;
  complete?: boolean | null;
};

export function formatCompletionStatus(
  item: CompletionStatusSource | null
): string {
  if (!item || item.locked) {
    return "";
  }

  if (item.complete === true) {
    return "Complete";
  }

  if (item.complete === false) {
    return "Work in Progress";
  }

  return "";
}