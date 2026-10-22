/**
 * The branch name without its city — comparison is within one city, so "רמי לוי
 * באר שבע" says nothing; null when nothing is left (the app shows the address).
 */
export function shortBranchName(name: string, city: string | null): string | null {
  let short = name;
  if (city) {
    const words = city.split(/[\s-]+/).filter(Boolean);
    const initials = words.length > 1 ? words.map((w) => w[0]) : null;
    const variants = [city, city.replace(/\s+/g, "-"), city.replace(/-/g, " ")];
    if (initials) variants.push(`${initials.join('"')}`, `${initials.join("'")}`, `${initials.join("׳")}`, `${initials.join("״")}`);
    for (const v of variants) short = short.split(v).join(" ");
  }
  short = short
    .replace(/\(\d+\)/g, " ")
    // Separators the city name was attached to ("דיל ב"ש- נווה מנחם").
    .replace(/(^|\s)[-–.·,]+(?=\s|$)/g, " ")
    .replace(/^[\s\-.·,]+|[\s\-.·,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return short.length >= 2 ? short : null;
}
