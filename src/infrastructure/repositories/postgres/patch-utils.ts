/**
 * Drops `id` (the row identity, addressed separately via WHERE) and any
 * `undefined`-valued keys (Drizzle's `.set()` otherwise tries to assign them)
 * from a partial domain patch before it's used as a Postgres SET clause.
 */
export function cleanPatch<T extends { id: string }>(
  patch: Partial<T>,
): Partial<Omit<T, "id">> {
  const { id: _id, ...rest } = patch;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<Omit<T, "id">>;
}
