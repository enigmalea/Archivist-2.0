type SeriesItem = {
  id: string | number;
  name: string;
};

type WorkSeriesSource = {
  locked?: boolean;
  series?: SeriesItem[] | null;
} | null;

type WorkSummarySource = {
  locked?: boolean;
  summary?: string | null;
} | null;

export function formatWorkSeries(work: WorkSeriesSource): string {
  if (work?.locked || !work?.series?.length) return "";

  const formattedSeries = work.series.map(
    ({ id, name }) => `[${name}](https://archiveofourown.org/series/${id})`,
  );

  return `**Series:** ${formattedSeries.join(", ")}`;
}

// TODO: parse from HTML to markdown.
export function formatWorkSummary(work: WorkSummarySource): string {
  if (work?.locked || !work) return "";

  const summary = work.summary?.trim();
  return summary || "N/A";
}