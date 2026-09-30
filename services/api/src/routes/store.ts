import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { checkoutRequestSchema } from "@pavielle/shared";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { orderLines, orders } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { listStoreProducts } from "../modules/catalog/service.js";
import { availability, variantIdsBySku } from "../modules/inventory/service.js";
import { createOrder, orderRef } from "../modules/orders/service.js";
import { buildCheckoutForm } from "../modules/payments/payhere.js";
import { handlePayHereNotification } from "../modules/payments/service.js";
import { expireHolds } from "../jobs/expire-holds.js";
import type { PayHereNotification } from "../modules/payments/payhere.js";

export function storeRoutes(db: Db, config: Config) {
  const r = new Hono();

  r.get("/products", async (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await listStoreProducts(db));
  });

  r.get("/products/:slug", async (c) => {
    const [p] = await listStoreProducts(db, c.req.param("slug"));
    if (!p) throw notFound("Product");
    return c.json(p);
  });

  /** Live stock for the static product pages: /store/availability?skus=A,B */
  r.get("/availability", async (c) => {
    const skus = (c.req.query("skus") ?? "").split(",").filter(Boolean).slice(0, 100);
    const ids = await variantIdsBySku(db, skus);
    const avail = await availability(db, [...ids.values()]);
    return c.json(Object.fromEntries(skus.map((s) => [s, Math.max(0, avail.get(ids.get(s)!) ?? 0)])));
  });

  r.post("/checkout", async (c) => {
    const req = checkoutRequestSchema.parse(await c.req.json());
    // Free up stock from abandoned checkouts before reserving (cheap when nothing has expired).
    await expireHolds(db, config.defaultLocationCode).catch((err) => console.warn("expireHolds failed", err));
    const order = await createOrder(db, req, { locationCode: config.defaultLocationCode });
    const ref = orderRef(order.number);
    let payment = null;
    if (order.paymentMethod === "PAYHERE") {
      const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
      payment = buildCheckoutForm(config.payhere, {
        orderRef: ref, amount: order.total,
        items: lines.map((l) => `${l.name} (${l.colour}/${l.size}) x${l.quantity}`).join(", "),
        firstName: order.firstName, lastName: order.lastName, email: order.email, phone: order.phone,
        address: [order.addressLine1, order.addressLine2].filter(Boolean).join(", "), city: order.city,
        returnUrl: `${config.storefrontUrl}/order/?ref=${ref}`,
        cancelUrl: `${config.storefrontUrl}/checkout/?cancelled=${ref}`,
        notifyUrl: `${config.publicApiUrl}/store/payments/payhere/notify`,
      });
    }
    return c.json({ orderRef: ref, status: order.status, total: order.total, payment }, 201);
  });

  /** Minimal order status lookup for the confirmation page (needs ref + phone). */
  r.get("/orders/:ref", async (c) => {
    const number = Number(c.req.param("ref").replace(/^PV-/, ""));
    const phone = c.req.query("phone");
    const [order] = Number.isFinite(number) ? await db.select().from(orders).where(eq(orders.number, number)) : [];
    if (!order || !phone || order.phone !== phone.replace(/[\s-]/g, "")) throw notFound("Order");
    return c.json({ orderRef: orderRef(order.number), status: order.status, total: order.total });
  });

  /** PayHere server-to-server callback (application/x-www-form-urlencoded). */
  r.post("/payments/payhere/notify", async (c) => {
    const body = (await c.req.parseBody()) as unknown as PayHereNotification;
    await handlePayHereNotification(db, config.payhere, body, config.defaultLocationCode);
    return c.text("OK");
  });

  return r;
}
