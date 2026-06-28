// Format the series for the works descriptions.
type WorkSeriesSource = {
  locked?: boolean;
  series?: Array<{ id: string | number; name: string }> | null;
};

export function formatWorkSeries(work: WorkSeriesSource | null ): string {
  if (!work || work.locked) {
    return "";
  }

  const seriesItems = Array.isArray(work.series) ? work.series : [];

  if (!seriesItems.length) {
    return "";
  }

  const formattedSeries = seriesItems.map((series) =>
    `[${series.name}](https://archiveofourown.org/series/${series.id})`
  );

  return `**Series:** ${formattedSeries.join(", ")}`;
}

// Formats the summary for works embed.
type WorkSummarySource = {
  locked?: boolean;
  summary?: string | null;
};

export function formatWorkSummary(
  work: WorkSummarySource
): string {
  if (!work || work.locked) {
    return "";
  }

  const summary = work.summary?.trim();

  if (!summary) {
    return "N/A";
  }

  return summary;
}