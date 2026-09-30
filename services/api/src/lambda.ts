import { handle, type LambdaEvent, type LambdaContext } from "hono/aws-lambda";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { getDb } from "./db/client.js";

let handler: ReturnType<typeof handle> | undefined;

/** API Gateway HTTP API (payload v2) entry point. */
export async function api(event: LambdaEvent, context: LambdaContext) {
  if (!handler) {
    const config = await loadConfig();
    handler = handle(createApp(getDb(config.databaseUrl), config));
  }
  return handler(event, context);
}
