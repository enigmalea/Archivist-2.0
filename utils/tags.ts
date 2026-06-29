type WorkTagSource = {
  locked?: boolean;
  category?: string[] | null;
  fandoms?: string[] | null;
  tags?: {
    warnings?: string[] | null;
    characters?: string[] | null;
    relationships?: string[] | null;
    additional?: string[] | null;
  } | null;
} | null | undefined;

function formatTagList(
  work: WorkTagSource,
  field: string[] | null | undefined,
): string {
  if (work?.locked) return "";
  return field?.length ? field.join(", ") : "N/A";
}

export const shipCategories = (work: WorkTagSource) =>
  formatTagList(work, work?.category);

export const formatFandoms = (work: WorkTagSource) =>
  formatTagList(work, work?.fandoms);

export const formatWarnings = (work: WorkTagSource) =>
  formatTagList(work, work?.tags?.warnings);

export const formatCharacters = (work: WorkTagSource) =>
  formatTagList(work, work?.tags?.characters);

export const formatRelationships = (work: WorkTagSource) =>
  formatTagList(work, work?.tags?.relationships);

export const formatTags = (work: WorkTagSource) =>
  formatTagList(work, work?.tags?.additional);