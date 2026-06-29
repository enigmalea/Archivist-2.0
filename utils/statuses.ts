import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat.js";

dayjs.extend(localizedFormat);

type WorkStatusSource = {
  locked?: boolean;
  publishedAt: string | Date;
  chapters: {
    published: number;
    total: number | null;
  };
};

type SeriesStatusSource = {
  startedAt: string | Date;
};

type UpdatedAtSource = {
  locked?: boolean;
  updatedAt?: string | Date | null;
};

type CompletionStatusSource = {
  locked?: boolean;
  complete?: boolean | null;
};

export function publishedDate(work: WorkStatusSource): string {
  if (work.locked) return "";
  return dayjs(work.publishedAt).format("ll");
}

export function startedDate(series: SeriesStatusSource): string {
  return dayjs(series.startedAt).format("ll");
}

export function updatedAt(item: UpdatedAtSource | null): string {
  if (!item || item.locked) return "";
  return item.updatedAt ? dayjs(item.updatedAt).format("ll") : "N/A";
}

export function chapterDisplay(work: WorkStatusSource): string {
  if (work.locked) return "";

  const { published, total } = work.chapters;
  return total == null ? `${published}/?` : `${published}/${total}`;
}

export function formatCompletionStatus(
  item: CompletionStatusSource | null,
): string {
  if (!item || item.locked) return "";
  if (item.complete === true) return "Complete";
  if (item.complete === false) return "Work in Progress";
  return "";
}