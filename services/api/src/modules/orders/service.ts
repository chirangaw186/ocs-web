import { and, eq, inArray, sql } from "drizzle-orm";
import { orderTotals, type CheckoutRequest, type OrderStatus } from "@pavielle/shared";
import type { Db, Tx } from "../../db/client.js";
import { customers, orderEvents, orderLines, orders, payments, products, reservations, variants } from "../../db/schema.js";
import { HttpError, notFound } from "../../lib/errors.js";
import { addStock, consumeReservations, getLocationId, releaseReservations, reserve } from "../inventory/service.js";

/** How long stock is held before an unpaid/unconfirmed order is cancelled automatically. */
export const HOLD_MINUTES = { PAYHERE: 30, COD: 48 * 60, BANK_TRANSFER: 48 * 60 } as const;

export const orderRef = (number: number) => `PV-${number}`;
export const parseOrderRef = (ref: string) => {
  const m = /^PV-(\d+)$/.exec(ref);
  return m ? Number(m[1]) : undefined;
};

/** Allowed status changes. Anything not listed is rejected. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["DISPATCHED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

export async function createOrder(db: Db, req: CheckoutRequest, opts: { locationCode: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const skus = [...new Set(req.items.map((i) => i.sku))];
  if (skus.length !== req.items.length) throw new HttpError(422, "Duplicate SKUs in cart");

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ variant: variants, productName: products.name, productStatus: products.status })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(inArray(variants.sku, skus));
    const bySku = new Map(rows.map((r) => [r.variant.sku, r]));
    const lines = req.items.map((item) => {
      const row = bySku.get(item.sku);
      if (!row || !row.variant.active || row.productStatus !== "ACTIVE") throw new HttpError(422, `${item.sku} is not available`);
      return { ...item, row };
    });
    const totals = orderTotals(lines.map((l) => ({ unitPrice: l.row.variant.price, quantity: l.quantity })));

    // Customer record keyed by phone (Sri Lankan customers mostly identify by mobile/WhatsApp).
    const [customer] = await tx.insert(customers)
      .values({ phone: req.customer.phone, email: req.customer.email, firstName: req.customer.firstName, lastName: req.customer.lastName })
      .onConflictDoUpdate({ target: customers.phone, set: { email: req.customer.email } })
      .returning();
    if (req.paymentMethod === "COD" && customer!.prepayOnly) {
      throw new HttpError(422, "Cash on delivery is not available for this account. Please pay online.", "prepay_only");
    }

    const [order] = await tx.insert(orders).values({
      status: req.paymentMethod === "PAYHERE" ? "PENDING_PAYMENT" : "AWAITING_CONFIRMATION",
      paymentMethod: req.paymentMethod,
      customerId: customer!.id,
      firstName: req.customer.firstName, lastName: req.customer.lastName,
      email: req.customer.email, phone: req.customer.phone,
      addressLine1: req.address.line1, addressLine2: req.address.line2,
      city: req.address.city, district: req.address.district, note: req.note,
      subtotal: totals.subtotal, deliveryFee: totals.delivery, total: totals.total,
    }).returning();

    await tx.insert(orderLines).values(lines.map((l) => ({
      orderId: order!.id, variantId: l.row.variant.id, sku: l.sku, name: l.row.productName,
      colour: l.row.variant.colour, size: l.row.variant.size, unitPrice: l.row.variant.price, quantity: l.quantity,
    })));
    await tx.insert(orderEvents).values({ orderId: order!.id, toStatus: order!.status, note: "Order placed" });

    const locationId = await getLocationId(tx, opts.locationCode);
    await reserve(tx, {
      orderId: order!.id, locationId,
      lines: lines.map((l) => ({ variantId: l.row.variant.id, sku: l.sku, quantity: l.quantity })),
      expiresAt: new Date(now.getTime() + HOLD_MINUTES[req.paymentMethod] * 60_000),
    });

    if (req.paymentMethod === "PAYHERE") {
      await tx.insert(payments).values({ orderId: order!.id, method: "PAYHERE", status: "INITIATED", amount: totals.total });
    }
    return order!;
  });
}

/**
 * The single place order status changes. Keeps stock in step with the order:
 *  - → CONFIRMED: reserved stock becomes a sale
 *  - → CANCELLED before confirmation: reservation released
 *  - → CANCELLED after confirmation (not yet dispatched): stock returned
 *  - FAILED_DELIVERY → RETURNED: parcel came back unopened, stock returned
 *  - DELIVERED → RETURNED: stock is NOT returned automatically (inspect first, then use a RETURN receipt)
 */
export async function transitionOrder(tx: Tx, args: {
  orderId: string; to: OrderStatus; note?: string; staffId?: string; locationCode: string;
}) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, args.orderId)).for("update");
  if (!order) throw notFound("Order");
  if (!TRANSITIONS[order.status].includes(args.to)) {
    throw new HttpError(409, `Cannot move order from ${order.status} to ${args.to}`, "invalid_transition");
  }
  const from = order.status;

  if (args.to === "CONFIRMED") await consumeReservations(tx, order.id, args.staffId);
  if (args.to === "CANCELLED" && (from === "PENDING_PAYMENT" || from === "AWAITING_CONFIRMATION")) {
    await releaseReservations(tx, order.id);
  }
  const restock = (args.to === "CANCELLED" && (from === "CONFIRMED" || from === "PACKED"))
    || (args.to === "RETURNED" && from === "FAILED_DELIVERY");
  if (restock) {
    const locationId = await getLocationId(tx, args.locationCode);
    for (const line of await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id))) {
      await addStock(tx, {
        variantId: line.variantId, locationId, quantity: line.quantity, type: "RETURN",
        reason: `${from} → ${args.to}`, orderId: order.id, staffId: args.staffId,
      });
    }
  }

  const [updated] = await tx.update(orders).set({ status: args.to }).where(eq(orders.id, order.id)).returning();
  await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: from, toStatus: args.to, note: args.note, staffId: args.staffId });
  return updated!;
}

/** Orders whose stock hold has expired without payment/confirmation. */
export async function findExpiredOrderIds(db: Db, now = new Date()) {
  const rows = await db
    .select({ orderId: reservations.orderId })
    .from(reservations)
    .innerJoin(orders, eq(orders.id, reservations.orderId))
    .where(and(
      eq(reservations.status, "ACTIVE"),
      inArray(orders.status, ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"]),
    ))
    .groupBy(reservations.orderId)
    .having(sql`max(${reservations.expiresAt}) <= ${now.toISOString()}`);
  return rows.map((r) => r.orderId);
}
