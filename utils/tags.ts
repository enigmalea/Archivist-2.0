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