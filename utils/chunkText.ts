export function chunkText(text: string, maxLength = 1024): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const cut = remaining.lastIndexOf("\n", maxLength);
    const splitAt = cut > 0 ? cut : maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

// chunkText, but a too-short trailing chunk gets folded into the one before
// it instead of becoming its own near-empty final page.
export function chunkTextMerged(text: string, maxLength: number, mergeThreshold = 250): string[] {
  const chunks = chunkText(text, maxLength);
  if (chunks.length >= 2 && chunks[chunks.length - 1].length < mergeThreshold) {
    const last = chunks.pop()!;
    chunks[chunks.length - 1] += "\n" + last;
  }
  return chunks;
}
