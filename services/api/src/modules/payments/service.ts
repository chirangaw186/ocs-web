import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { orderEvents, orders, payments } from "../../db/schema.js";
import { HttpError } from "../../lib/errors.js";
import { parseOrderRef, transitionOrder } from "../orders/service.js";
import { PAYHERE_STATUS, parseAmount, verifyNotification, type PayHereConfig, type PayHereNotification } from "./payhere.js";

/**
 * Handles PayHere's server-to-server notification. This — never the browser redirect —
 * is what marks an order as paid. Safe to receive the same notification more than once.
 */
export async function handlePayHereNotification(db: Db, cfg: PayHereConfig, n: PayHereNotification, locationCode: string) {
  if (!verifyNotification(cfg, n)) throw new HttpError(401, "Invalid PayHere signature", "bad_signature");
  const number = parseOrderRef(n.order_id);
  if (number === undefined) throw new HttpError(422, "Unknown order reference");
  const status = PAYHERE_STATUS[n.status_code as keyof typeof PAYHERE_STATUS];
  if (!status) throw new HttpError(422, `Unknown PayHere status ${n.status_code}`);
  const amount = parseAmount(n.payhere_amount);

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.number, number)).for("update");
    if (!order) throw new HttpError(404, "Order not found");

    // Upsert the payment row for this attempt (idempotent on PayHere's payment_id).
    const [existing] = await tx.select().from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.method, "PAYHERE")))
      .for("update");
    if (existing?.status === "SUCCEEDED" && status === "SUCCEEDED") return { order, duplicate: true };
    const values = { status, amount, providerRef: n.payment_id, raw: redact(n) };
    if (existing) await tx.update(payments).set(values).where(eq(payments.id, existing.id));
    else await tx.insert(payments).values({ orderId: order.id, method: "PAYHERE", ...values });

    const note = (text: string) => tx.insert(orderEvents).values({ orderId: order.id, toStatus: order.status, note: text });

    if (status === "SUCCEEDED") {
      if (amount !== order.total || n.payhere_currency !== "LKR") {
        await note(`PayHere amount mismatch: received ${n.payhere_amount} ${n.payhere_currency}. Needs review.`);
        return { order, needsReview: true };
      }
      if (order.status === "PENDING_PAYMENT") {
        return { order: await transitionOrder(tx, { orderId: order.id, to: "CONFIRMED", note: `Paid via PayHere (${n.payment_id})`, locationCode }) };
      }
      // e.g. the stock hold expired and the order was cancelled before the payment arrived.
      await note(`Payment ${n.payment_id} received while order was ${order.status}. Refund or restore manually.`);
      return { order, needsReview: true };
    }
    if ((status === "FAILED" || status === "CANCELLED") && order.status === "PENDING_PAYMENT") {
      return { order: await transitionOrder(tx, { orderId: order.id, to: "CANCELLED", note: `PayHere payment ${status.toLowerCase()}`, locationCode }) };
    }
    if (status === "CHARGEDBACK") await note(`Chargeback on PayHere payment ${n.payment_id}`);
    return { order };
  });
}

/** Never store card details, even masked ones, in our database. */
function redact(n: PayHereNotification) {
  const { card_no: _c, card_holder_name: _h, card_expiry: _e, md5sig: _s, ...rest } = n;
  return rest;
}
