import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/src/infrastructure/db/schema";

/**
 * Database target for the price scripts.
 *   CI (GitHub Actions) -> $DATABASE_URL from the workflow secret
 *   default             -> dev branch (.env.development.local)
 *   --prod              -> production (.env.local)
 */

function readEnvVar(envFile: string, key: string): string {
  const content = readFileSync(envFile, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${envFile}`);
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
}

export function resolveDatabase(argv: string[] = process.argv) {
  if (process.env.CI === "true") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set in CI");
    return { url, target: "ci" as const };
  }
  const isProd = argv.includes("--prod");
  const envFile = isProd ? ".env.local" : ".env.development.local";
  return { url: readEnvVar(envFile, "DATABASE_URL"), target: isProd ? ("production" as const) : ("dev" as const) };
}

export function connect(argv: string[] = process.argv) {
  const { url, target } = resolveDatabase(argv);
  const sql = neon(url);
  return { sql, db: drizzle(sql, { schema }), target };
}
