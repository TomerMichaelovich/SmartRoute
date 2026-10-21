import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

/**
 * The raw Neon client, for the few queries that pass whole arrays as single
 * parameters (unnest / ANY) — drizzle's `sql` template expands an array into a
 * list of separate parameters instead.
 */
export const rawSql = sql;
