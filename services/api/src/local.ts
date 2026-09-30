import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { getDb } from "./db/client.js";
import { expireHolds } from "./jobs/expire-holds.js";

const config = await loadConfig();
const db = getDb(config.databaseUrl);
serve({ fetch: createApp(db, config).fetch, port: 8787 }, (i) => console.log(`API on http://localhost:${i.port}`));
// Mimic the scheduled job locally.
setInterval(() => expireHolds(db, config.defaultLocationCode).catch(console.error), 60 * 60_000);
