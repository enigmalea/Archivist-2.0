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
