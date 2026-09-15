import { loadEnvConfig } from "@next/env";

// `dev: true` so these scripts load .env.development.local (the isolated Neon dev
// branch) the same way `next dev` does. Without it, loadEnvConfig defaults to
// "production" mode and every script here would silently hit the real database.
loadEnvConfig(process.cwd(), true);
