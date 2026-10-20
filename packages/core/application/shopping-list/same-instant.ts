/**
 * List timestamps reach the app in two spellings: ISO strings written by the code
 * ("2026-10-13T10:33:34.507Z") and Postgres's own rendering when read back
 * ("2026-10-13 10:33:34.507", UTC without a zone). Comparing them as strings made a
 * list look changed by "someone else" right after the user's own save - compare the
 * instants instead.
 */
export function toInstant(timestamp: string): number {
  return Date.parse(timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`);
}

export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b;
  return toInstant(a) === toInstant(b);
}
