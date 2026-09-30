import { loadConfig } from "../config.js";
import { getDb, type Db } from "../db/client.js";
import { findExpiredOrderIds, transitionOrder } from "../modules/orders/service.js";
import { HttpError } from "../lib/errors.js";

/** Cancels unpaid / unconfirmed orders whose stock hold has expired. */
export async function expireHolds(db: Db, locationCode: string, now = new Date()) {
  let cancelled = 0;
  for (const orderId of await findExpiredOrderIds(db, now)) {
    try {
      await db.transaction((tx) => transitionOrder(tx, { orderId, to: "CANCELLED", note: "Stock hold expired", locationCode }));
      cancelled++;
    } catch (err) {
      // Payment/confirmation may have landed in the meantime — that is fine.
      if (!(err instanceof HttpError && err.code === "invalid_transition")) throw err;
    }
  }
  return { cancelled };
}

/** EventBridge Scheduler entry point (hourly safety net; checkout also runs expireHolds). */
export async function handler() {
  const config = await loadConfig();
  const result = await expireHolds(getDb(config.databaseUrl), config.defaultLocationCode);
  console.log(JSON.stringify({ job: "expire-holds", ...result }));
  return result;
}
