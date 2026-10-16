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
