import { load } from "cheerio";

// Counts words in chapter content the same way ao3_api's Chapter.words did:
// walk paragraph-level tags only, not the whole content blob.
export function countChapterWords(html: string | null | undefined): number {
  if (!html) return 0;
  const $ = load(html);
  const text = $("p, center").text();
  return text.trim().split(/\s+/).filter(Boolean).length;
}