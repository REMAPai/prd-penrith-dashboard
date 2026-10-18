/** An agent's name with each word capitalised, as it should read on screen ("thomas latty" becomes "Thomas Latty"). */
export const titleName = (name: string): string => name.replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** Up to two capital letters from a buyer's name, for the avatar circle. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, "")[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters ? letters.toUpperCase() : "?";
}
