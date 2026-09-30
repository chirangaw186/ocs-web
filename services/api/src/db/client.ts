import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let cached: { pool: pg.Pool; db: Db } | undefined;

/**
 * One small pool per Lambda container. Point DATABASE_URL at Neon's *pooled* connection
 * string (host contains "-pooler"), so PgBouncer multiplexes connections from many Lambdas.
 */
export function getDb(url = process.env.DATABASE_URL): Db {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) {
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX ?? 2),
      idleTimeoutMillis: 10_000,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: true },
    });
    cached = { pool, db: drizzle(pool, { schema }) };
  }
  return cached.db;
}

export async function closeDb() {
  await cached?.pool.end();
  cached = undefined;
}
