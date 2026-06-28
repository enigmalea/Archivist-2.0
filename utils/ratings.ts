// Define the embed sidebar based on the work rating.
export function embedColor(work: any): number | null {
  if (work?.locked) {
    return null;
  }

  let color: number | null = null;

  switch (work?.rating) {
    case "Not Rated":
      color = 0xffffff;
      break;

    case "General Audiences":
      color = 0x77a50e;
      break;

    case "Teen And Up Audiences":
      color = 0xe8d506;
      break;

    case "Mature":
      color = 0xde7e28;
      break;

    case "Explicit":
      color = 0x9c0000;
      break;
  }

  return color;
}

// Define the rating icon based on the work rating.
export function ratingIcon(work: any): string | undefined {
  if (work?.locked) {
    return undefined;
  }

  switch (work?.rating) {
    case "Not Rated":
      return "<:notrated:866825856236519426>";
    case "General Audiences":
      return "<:general:866823809180631040>";
    case "Teen And Up Audiences":
      return "<:teen:866823893015330826>";
    case "Mature":
      return "<:mature:866823956684996628>";
    case "Explicit":
      return "<:explicit:866824069050269736>";
    default:
      return undefined;
  }
}