// Formats the categories for works.
export function shipCategories(work: any): string {
	let allCategories;
  if (work?.locked) {
    return "";
  } else {
    switch (work.category) {
      case null:
        allCategories = `N/A`;
        break;
      default:
        allCategories = work.category.join(", ");
        break;
    }
  }
  return allCategories;
};

// Formats fandoms for works and chapter embeds.
export function formatFandoms(work: any): string {
	let allFandoms;
  if (work?.locked) {
    return "";
  } else {
    switch (work.fandoms) {
      case null:
        allFandoms = `N/A`;
        break;
      default:
        allFandoms = work.fandoms.join(", ");
        break;
    }
  }
  return allFandoms;
};

// Formats warning for works and chapter embeds.
export function formatWarnings(work: any): string {
	let allWarnings;
  if (work?.locked) {
    return "";
  } else {
    switch (work.tags.warnings) {
      case null:
        allWarnings = `N/A`;
        break;
      default:
        allWarnings = work.tags.warnings.join(", ");
        break;
    }
  }
  return allWarnings;
};

export function formatCharacters(work: any): string {
	let allCharacters;
  if (work?.locked) {
    return "";
  } else {
    switch (work.tags.characters) {
      case null:
        allCharacters = `N/A`;
        break;
      default:
        allCharacters = work.tags.characters.join(", ");
        break;
    }
  }
  return allCharacters;
};

export function formatRelationships(work: any): string {
	let allRelationships;
  if (work?.locked) {
    return "";
  } else {
    switch (work.tags.relationship) {
      case null:
        allRelationships = `N/A`;
        break;
      default:
        allRelationships = work.tags.relationships.join(", ");
        break;
    }
  }
  return allRelationships;
};

export function formatTags(work: any): string {
	let allTags;
  if (work?.locked) {
    return "";
  } else {
    switch (work.tags.additional) {
      case null:
        allTags = `N/A`;
        break;
      default:
        allTags = work.tags.additional.join(", ");
        break;
    }
  }
  return allTags;
};