// Truncates at the nearest word boundary before `max` so words aren't cut
// mid-way, falling back to a hard cut only when the boundary would discard
// more than half the allowed length (e.g. one very long unbroken token).
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;

  const ellipsis = "…";
  const limit = Math.max(max - ellipsis.length, 0);
  const slice = text.slice(0, limit);

  const lastBreak = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf(","),
  );
  const cut = lastBreak > limit * 0.5 ? lastBreak : limit;

  // Strip any trailing punctuation/ellipsis from the original text so it
  // doesn't stack with the appended ellipsis (e.g. ".…" reading as 4 dots).
  const trimmed = text.slice(0, cut).trimEnd().replace(/[.…]+$/, "");

  return trimmed + ellipsis;
}
