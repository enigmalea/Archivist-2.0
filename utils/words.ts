import { load } from "cheerio";

export function countChapterWords(html: string | null | undefined): number {
  if (!html) return 0;

  const $ = load(html);
  const text = $("p, center").text().trim();
  return text ? text.split(/\s+/).length : 0;
}