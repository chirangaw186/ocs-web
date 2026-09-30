import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../config.js";
import { closeDb, getDb } from "./client.js";

/**
 * Applies SQL migrations from ./drizzle. Runs locally (`pnpm db:migrate`) and as a one-off
 * Lambda invoked by CI after each deploy. Use Neon's *direct* (non-pooled) URL for migrations.
 */
export async function runMigrations() {
  const config = await loadConfig();
  const url = process.env.DATABASE_DIRECT_URL ?? config.databaseUrl;
  const here = dirname(fileURLToPath(import.meta.url));
  // Bundled Lambda: ./drizzle next to index.mjs. Source checkout: services/api/drizzle.
  const folder = process.env.MIGRATIONS_DIR ?? (existsSync(join(here, "drizzle")) ? join(here, "drizzle") : join(here, "../../drizzle"));
  await migrate(getDb(url), { migrationsFolder: folder });
  await closeDb();
  return { ok: true };
}

export const handler = runMigrations;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations().then(() => console.log("Migrations applied")).catch((e) => { console.error(e); process.exit(1); });
}
