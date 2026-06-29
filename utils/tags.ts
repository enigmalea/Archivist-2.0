function formatTagList(work: any, field: string[] | null | undefined): string {
  if (work?.locked) return "";
  if (!field) return "N/A";
  return field.join(", ");
}

export const shipCategories = (work: any) => formatTagList(work, work?.category);
export const formatFandoms = (work: any) => formatTagList(work, work?.fandoms);
export const formatWarnings = (work: any) => formatTagList(work, work?.tags?.warnings);
export const formatCharacters = (work: any) => formatTagList(work, work?.tags?.characters);
export const formatRelationships = (work: any) => formatTagList(work, work?.tags?.relationships);
export const formatTags = (work: any) => formatTagList(work, work?.tags?.additional);