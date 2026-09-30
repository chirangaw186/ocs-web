import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { Db } from "../src/db/client.js";
import { orders, reservations } from "../src/db/schema.js";
import { expireHolds } from "../src/jobs/expire-holds.js";
import { checkoutBody, freshApp, json, OWNER, signedNotification } from "./helpers.js";

let app: Hono; let db: Db;
const available = async (sku: string) =>
  (await (await app.request(`/store/availability?skus=${sku}`)).json())[sku] as number;
const notify = (n: Record<string, string>) =>
  app.request("/store/payments/payhere/notify", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(n).toString(),
  });
const transition = (id: string, to: string) => app.request(`/admin/orders/${id}/transition`, json({ to }, OWNER));
const orderByRef = async (ref: string) => (await db.select().from(orders).where(eq(orders.number, Number(ref.slice(3)))))[0]!;

beforeEach(async () => { ({ app, db } = await freshApp()); });

describe("catalogue", () => {
  it("lists active products with live availability", async () => {
    const products = await (await app.request("/store/products")).json();
    expect(products).toHaveLength(2);
    expect(products[0].variants.find((v: { sku: string }) => v.sku === "PV-SMD-01-BLS-M").available).toBe(4);
  });
});

describe("checkout", () => {
  it("COD order reserves stock and waits for staff confirmation", async () => {
    const res = await app.request("/store/checkout", json(checkoutBody()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ status: "AWAITING_CONFIRMATION", total: 1_230_000, payment: null });
    expect(await available("PV-SMD-01-BLS-M")).toBe(3);
  });

  it("free delivery at or above Rs. 15,000", async () => {
    const body = await (await app.request("/store/checkout", json(checkoutBody({ items: [{ sku: "PV-SMD-01-BLS-M", quantity: 2 }] })))).json();
    expect(body.total).toBe(2 * 1_190_000);
  });

  it("rejects invalid input", async () => {
    const res = await app.request("/store/checkout", json(checkoutBody({ customer: { firstName: "A", lastName: "B", email: "x", phone: "123" } })));
    expect(res.status).toBe(400);
  });

  it("never oversells the last unit under concurrent checkouts", async () => {
    // XS has 1 unit. Fire 5 checkouts at once.
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      app.request("/store/checkout", json(checkoutBody({ items: [{ sku: "PV-SMD-01-BLS-XS", quantity: 1 }] })))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await available("PV-SMD-01-BLS-XS")).toBe(0);
  });
});

describe("PayHere payments", () => {
  const payhereCheckout = async () =>
    (await app.request("/store/checkout", json(checkoutBody({ paymentMethod: "PAYHERE" })))).json();

  it("returns a signed PayHere form and confirms the order on a valid notification", async () => {
    const co = await payhereCheckout();
    expect(co.status).toBe("PENDING_PAYMENT");
    expect(co.payment.fields).toMatchObject({ order_id: co.orderRef, amount: "12300.00", currency: "LKR" });

    const res = await notify(signedNotification({ order_id: co.orderRef }) as unknown as Record<string, string>);
    expect(res.status).toBe(200);
    expect((await orderByRef(co.orderRef)).status).toBe("CONFIRMED");
    expect(await available("PV-SMD-01-BLS-M")).toBe(3);

    // Duplicate notification is harmless.
    expect((await notify(signedNotification({ order_id: co.orderRef }) as unknown as Record<string, string>)).status).toBe(200);
    expect(await available("PV-SMD-01-BLS-M")).toBe(3);
  });

  it("rejects a forged notification", async () => {
    const co = await payhereCheckout();
    const forged = { ...signedNotification({ order_id: co.orderRef }), md5sig: "0".repeat(32) };
    expect((await notify(forged as unknown as Record<string, string>)).status).toBe(401);
    expect((await orderByRef(co.orderRef)).status).toBe("PENDING_PAYMENT");
  });

  it("flags an amount mismatch instead of confirming", async () => {
    const co = await payhereCheckout();
    await notify(signedNotification({ order_id: co.orderRef, payhere_amount: "100.00" }) as unknown as Record<string, string>);
    expect((await orderByRef(co.orderRef)).status).toBe("PENDING_PAYMENT");
  });

  it("cancels and releases stock when payment fails", async () => {
    const co = await payhereCheckout();
    await notify(signedNotification({ order_id: co.orderRef, status_code: "-2" }) as unknown as Record<string, string>);
    expect((await orderByRef(co.orderRef)).status).toBe("CANCELLED");
    expect(await available("PV-SMD-01-BLS-M")).toBe(4);
  });
});

describe("stock holds and order lifecycle", () => {
  it("expires unpaid holds and returns stock", async () => {
    const co = await (await app.request("/store/checkout", json(checkoutBody({ paymentMethod: "PAYHERE" })))).json();
    const order = await orderByRef(co.orderRef);
    expect((await expireHolds(db, "HOME")).cancelled).toBe(0);
    await db.update(reservations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(reservations.orderId, order.id));
    expect((await expireHolds(db, "HOME")).cancelled).toBe(1);
    expect((await orderByRef(co.orderRef)).status).toBe("CANCELLED");
    expect(await available("PV-SMD-01-BLS-M")).toBe(4);
  });

  it("walks a COD order through dispatch, failed delivery and return", async () => {
    const co = await (await app.request("/store/checkout", json(checkoutBody()))).json();
    const { id } = await orderByRef(co.orderRef);
    for (const to of ["CONFIRMED", "PACKED", "DISPATCHED", "FAILED_DELIVERY"]) expect((await transition(id, to)).status).toBe(200);
    expect(await available("PV-SMD-01-BLS-M")).toBe(3);
    expect((await transition(id, "RETURNED")).status).toBe(200);
    expect(await available("PV-SMD-01-BLS-M")).toBe(4);   // unopened parcel back in stock
  });

  it("rejects invalid transitions", async () => {
    const co = await (await app.request("/store/checkout", json(checkoutBody()))).json();
    const { id } = await orderByRef(co.orderRef);
    expect((await transition(id, "DELIVERED")).status).toBe(409);
  });
});

describe("admin", () => {
  it("requires a staff identity", async () => {
    expect((await app.request("/admin/inventory")).status).toBe(403);
    const res = await app.request("/admin/inventory", { headers: OWNER });
    expect(res.status).toBe(200);
    expect((await res.json()).find((r: { sku: string }) => r.sku === "PV-FMX-01-SGE-L")).toMatchObject({ onHand: 3, available: 3 });
  });

  it("receives stock and blocks adjustments below reserved", async () => {
    await app.request("/admin/inventory/receipts", json({ lines: [{ sku: "PV-SMD-01-BLS-XS", quantity: 5 }] }, OWNER));
    expect(await available("PV-SMD-01-BLS-XS")).toBe(6);
    await app.request("/store/checkout", json(checkoutBody({ items: [{ sku: "PV-SMD-01-BLS-XS", quantity: 6 }] })));
    const res = await app.request("/admin/inventory/adjustments", json({ sku: "PV-SMD-01-BLS-XS", delta: -1, reason: "count" }, OWNER));
    expect(res.status).toBe(409);
  });
});

describe("expired holds at checkout", () => {
  it("releases an abandoned hold so the next customer can buy the last unit", async () => {
    const first = await (await app.request("/store/checkout", json(checkoutBody({ paymentMethod: "PAYHERE", items: [{ sku: "PV-SMD-01-BLS-XS", quantity: 1 }] })))).json();
    const order = await orderByRef(first.orderRef);
    expect((await app.request("/store/checkout", json(checkoutBody({ items: [{ sku: "PV-SMD-01-BLS-XS", quantity: 1 }] })))).status).toBe(409);
    await db.update(reservations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(reservations.orderId, order.id));
    expect((await app.request("/store/checkout", json(checkoutBody({ items: [{ sku: "PV-SMD-01-BLS-XS", quantity: 1 }] })))).status).toBe(201);
    expect((await orderByRef(first.orderRef)).status).toBe("CANCELLED");
  });
});
