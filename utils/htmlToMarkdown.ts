import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndownService.addRule("underline", {
  filter: "u",
  replacement: (content) => `__${content}__`,
});

export function htmlToMarkdown(html: string | null | undefined): string | null {
  if (!html) return null;

  const markdown = turndownService.turndown(html);

  const lines = markdown.split("\n").map((line) => line.trim());

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
