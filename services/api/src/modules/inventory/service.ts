/**
 * Inventory rules
 * - `levels` holds current on_hand / reserved per variant+location; `movements` is the audit ledger.
 * - Every change updates both in the same transaction.
 * - Reservations hold stock during checkout (PayHere) or until staff confirm a COD order.
 *   available = on_hand - reserved. Reserving uses a conditional UPDATE, so two customers
 *   can never both buy the last unit.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "../../db/client.js";
import { levels, locations, movements, reservations, variants } from "../../db/schema.js";
import { HttpError, OutOfStockError, notFound } from "../../lib/errors.js";

type Conn = Db | Tx;

export async function getLocationId(db: Conn, code: string): Promise<string> {
  const [loc] = await db.select({ id: locations.id }).from(locations).where(eq(locations.code, code));
  if (!loc) throw notFound(`Location ${code}`);
  return loc.id;
}

export async function variantIdsBySku(db: Conn, skus: string[]) {
  const rows = await db.select({ id: variants.id, sku: variants.sku }).from(variants).where(inArray(variants.sku, skus));
  const map = new Map(rows.map((r) => [r.sku, r.id]));
  for (const sku of skus) if (!map.has(sku)) throw notFound(`SKU ${sku}`);
  return map;
}

/** Available quantity per variant id, summed across locations. */
export async function availability(db: Conn, variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db
    .select({
      variantId: levels.variantId,
      available: sql<number>`coalesce(sum(${levels.onHand} - ${levels.reserved}), 0)::int`,
    })
    .from(levels)
    .where(inArray(levels.variantId, variantIds))
    .groupBy(levels.variantId);
  return new Map(rows.map((r) => [r.variantId, r.available]));
}

export interface ReserveLine { variantId: string; sku: string; quantity: number }

export async function reserve(tx: Tx, args: { orderId: string; locationId: string; lines: ReserveLine[]; expiresAt: Date }) {
  // Lock rows in a stable order to avoid deadlocks between concurrent checkouts.
  const lines = [...args.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const line of lines) {
    const updated = await tx
      .update(levels)
      .set({ reserved: sql`${levels.reserved} + ${line.quantity}` })
      .where(and(
        eq(levels.variantId, line.variantId),
        eq(levels.locationId, args.locationId),
        sql`${levels.onHand} - ${levels.reserved} >= ${line.quantity}`,
      ))
      .returning({ variantId: levels.variantId });
    if (updated.length === 0) throw new OutOfStockError(line.sku);
    await tx.insert(reservations).values({
      variantId: line.variantId, locationId: args.locationId, orderId: args.orderId,
      quantity: line.quantity, expiresAt: args.expiresAt,
    });
  }
}

async function activeReservations(tx: Tx, orderId: string) {
  return tx.select().from(reservations)
    .where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")))
    .for("update");
}

/** Order confirmed: reserved stock leaves on_hand and a SALE movement is recorded. */
export async function consumeReservations(tx: Tx, orderId: string, staffId?: string) {
  for (const r of await activeReservations(tx, orderId)) {
    await tx.update(levels).set({
      reserved: sql`${levels.reserved} - ${r.quantity}`,
      onHand: sql`${levels.onHand} - ${r.quantity}`,
    }).where(and(eq(levels.variantId, r.variantId), eq(levels.locationId, r.locationId)));
    await tx.insert(movements).values({
      variantId: r.variantId, locationId: r.locationId, type: "SALE", quantity: -r.quantity, orderId, staffId,
    });
    await tx.update(reservations).set({ status: "CONSUMED" }).where(eq(reservations.id, r.id));
  }
}

/** Order cancelled / payment failed / hold expired: give reserved stock back. */
export async function releaseReservations(tx: Tx, orderId: string) {
  for (const r of await activeReservations(tx, orderId)) {
    await tx.update(levels).set({ reserved: sql`${levels.reserved} - ${r.quantity}` })
      .where(and(eq(levels.variantId, r.variantId), eq(levels.locationId, r.locationId)));
    await tx.update(reservations).set({ status: "RELEASED" }).where(eq(reservations.id, r.id));
  }
}

/** Add sellable stock: production receipts, returns, cancellations after confirmation. */
export async function addStock(tx: Tx, args: {
  variantId: string; locationId: string; quantity: number;
  type: "RECEIPT" | "RETURN"; reason?: string; orderId?: string; batchId?: string; staffId?: string;
}) {
  if (args.quantity <= 0) throw new HttpError(422, "Quantity must be positive");
  await tx.insert(levels).values({ variantId: args.variantId, locationId: args.locationId, onHand: args.quantity })
    .onConflictDoUpdate({
      target: [levels.variantId, levels.locationId],
      set: { onHand: sql`${levels.onHand} + ${args.quantity}` },
    });
  await tx.insert(movements).values({
    variantId: args.variantId, locationId: args.locationId, type: args.type, quantity: args.quantity,
    reason: args.reason, orderId: args.orderId, batchId: args.batchId, staffId: args.staffId,
  });
}

/** Stock-count correction or write-off. Cannot take on_hand below what is reserved. */
export async function adjustStock(tx: Tx, args: {
  variantId: string; locationId: string; delta: number; type: "ADJUSTMENT" | "WRITE_OFF"; reason: string; staffId?: string;
}) {
  if (args.delta === 0) throw new HttpError(422, "Delta cannot be zero");
  if (args.type === "WRITE_OFF" && args.delta > 0) throw new HttpError(422, "Write-offs must be negative");
  const updated = await tx.update(levels)
    .set({ onHand: sql`${levels.onHand} + ${args.delta}` })
    .where(and(
      eq(levels.variantId, args.variantId), eq(levels.locationId, args.locationId),
      sql`${levels.onHand} + ${args.delta} >= ${levels.reserved}`,
    ))
    .returning({ onHand: levels.onHand });
  if (updated.length === 0) {
    if (args.delta < 0) throw new HttpError(409, "Adjustment would take stock below reserved/zero", "insufficient_stock");
    await tx.insert(levels).values({ variantId: args.variantId, locationId: args.locationId, onHand: args.delta });
  }
  await tx.insert(movements).values({
    variantId: args.variantId, locationId: args.locationId, type: args.type, quantity: args.delta,
    reason: args.reason, staffId: args.staffId,
  });
}
