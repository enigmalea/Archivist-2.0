import { getUserProfileUrl } from "@fujocoded/ao3.js/urls";

type CreatorLike = {
  pseud?: string;
  username?: string;
  name?: string;
  anonymous?: boolean;
};

type CreatorContainer =
  | {
      anonymous?: boolean;
      authors?: CreatorLike[];
      creators?: CreatorLike[];
    }
  | CreatorLike[];

export function constructCreators(
  source: CreatorContainer | undefined,
  anonymous?: boolean
): string {
  const creators = Array.isArray(source)
    ? source
    : source?.authors ?? source?.creators ?? [];

  const isAnonymous =
    anonymous ?? (Array.isArray(source) ? false : source?.anonymous ?? false);

  if (isAnonymous) {
    return "Anonymous";
  }

  if (!creators.length) {
    return "";
  }

  return creators
    .map((creator) => {
      const display = creator.pseud ?? creator.name ?? "Anonymous";
      const username = creator.username;

      if (!username) {
        return display;
      }

      return `[${display}](${getUserProfileUrl({ username })})`;
    })
    .join(", ");
}