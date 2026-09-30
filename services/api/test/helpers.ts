import { createHash } from "node:crypto";
import type { PayHereNotification } from "../src/modules/payments/payhere.js";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { getDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";

export async function freshApp() {
  const db = getDb();
  await db.execute(sql`DROP SCHEMA IF EXISTS catalog, inventory, sales, people, production, drizzle CASCADE`);
  await runMigrations();
  const db2 = getDb();
  await seed(db2);
  const config = await loadConfig();
  return { db: db2, config, app: createApp(db2, config) };
}

export const checkoutBody = (over: Record<string, unknown> = {}) => ({
  items: [{ sku: "PV-SMD-01-BLS-M", quantity: 1 }],
  customer: { firstName: "Nimali", lastName: "Perera", email: "nimali@example.lk", phone: "0771234567" },
  address: { line1: "12 Temple Road", city: "Maharagama", district: "Colombo" },
  paymentMethod: "COD",
  ...over,
});

export const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
export const OWNER = { "x-dev-staff-email": "owner@pavielle.test" };

const cfg = { merchantId: "1211149", merchantSecret: "test-secret" };
const md5 = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();

export function signedNotification(over: Partial<PayHereNotification> = {}): PayHereNotification {
  const n = { merchant_id: cfg.merchantId, order_id: "PV-1", payment_id: "320025071278", payhere_amount: "12300.00",
    payhere_currency: "LKR", status_code: "2", md5sig: "", ...over };
  n.md5sig = md5(n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5(cfg.merchantSecret));
  return n;
}

