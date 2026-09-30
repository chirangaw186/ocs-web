import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import { HttpError } from "./lib/errors.js";
import { adminRoutes } from "./routes/admin.js";
import { storeRoutes } from "./routes/store.js";

/**
 * One Lambda, one Hono app, many modules. Split into more Lambdas later only if a module
 * needs different scaling or permissions.
 */
export function createApp(db: Db, config: Config) {
  const app = new Hono();
  app.use("*", cors({
    origin: config.allowedOrigins,
    allowHeaders: ["Content-Type", "Authorization", "x-dev-staff-email"],
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    maxAge: 600,
  }));

  app.get("/health", (c) => c.json({ ok: true, stage: config.stage }));
  app.route("/store", storeRoutes(db, config));
  app.route("/admin", adminRoutes(db, config));

  app.onError((err, c) => {
    if (err instanceof ZodError) return c.json({ error: "validation_error", issues: err.issues }, 400);
    if (err instanceof HttpError) return c.json({ error: err.code, message: err.message }, err.status);
    console.error(err);
    return c.json({ error: "internal_error", message: "Something went wrong" }, 500);
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return app;
}
