import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES } from "@pavielle/shared";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { levels, orderEvents, orderLines, orders, payments, productImages, products, shipments, staff, variants } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { triggerStorefrontRebuild } from "../modules/catalog/service.js";
import { addStock, adjustStock, getLocationId, variantIdsBySku } from "../modules/inventory/service.js";
import { orderRef, transitionOrder } from "../modules/orders/service.js";
import { requireStaff, type AppEnv } from "../modules/staff/auth.js";

const productInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  styleCode: z.string().min(2),
  name: z.string().min(2),
  description: z.string().default(""),
  fabric: z.string().optional(),
  care: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  variants: z.array(z.object({
    sku: z.string().min(3), colour: z.string().min(1), size: z.string().min(1), price: z.number().int().positive(),
  })).min(1),
  images: z.array(z.object({ url: z.url(), alt: z.string().default(""), colour: z.string().optional() })).default([]),
});

export function adminRoutes(db: Db, config: Config) {
  const r = new Hono<AppEnv>();
  const loc = config.defaultLocationCode;
  const anyStaff = requireStaff(db, config);
  const managers = requireStaff(db, config, ["ADMIN"]);
  const ops = requireStaff(db, config, ["ADMIN", "PACKER", "CUSTOMER_CARE"]);

  r.get("/me", anyStaff, (c) => c.json(c.get("staff")));

  /* ── Orders ── */
  r.get("/orders", ops, async (c) => {
    const status = c.req.query("status");
    const where = status ? inArray(orders.status, status.split(",") as (typeof ORDER_STATUSES)[number][]) : undefined;
    const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(200);
    return c.json(rows.map((o) => ({ ...o, ref: orderRef(o.number) })));
  });

  r.get("/orders/:id", ops, async (c) => {
    const id = c.req.param("id");
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) throw notFound("Order");
    const [lines, events, pays, ships] = await Promise.all([
      db.select().from(orderLines).where(eq(orderLines.orderId, id)),
      db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(orderEvents.createdAt),
      db.select().from(payments).where(eq(payments.orderId, id)),
      db.select().from(shipments).where(eq(shipments.orderId, id)),
    ]);
    return c.json({ ...order, ref: orderRef(order.number), lines, events, payments: pays, shipments: ships });
  });

  r.post("/orders/:id/transition", ops, async (c) => {
    const body = z.object({ to: z.enum(ORDER_STATUSES), note: z.string().max(500).optional() }).parse(await c.req.json());
    const order = await db.transaction((tx) => transitionOrder(tx, {
      orderId: c.req.param("id"), to: body.to, note: body.note, staffId: c.get("staff").id, locationCode: loc,
    }));
    return c.json(order);
  });

  r.post("/orders/:id/shipments", ops, async (c) => {
    const body = z.object({ courier: z.string().min(2), trackingNumber: z.string().optional() }).parse(await c.req.json());
    const [order] = await db.select().from(orders).where(eq(orders.id, c.req.param("id")));
    if (!order) throw notFound("Order");
    const [s] = await db.insert(shipments).values({
      orderId: order.id, courier: body.courier, trackingNumber: body.trackingNumber,
      codAmount: order.paymentMethod === "COD" ? order.total : 0,
    }).returning();
    return c.json(s, 201);
  });

  /** Weekly COD reconciliation: mark courier remittances as received. */
  r.post("/shipments/cod-remitted", managers, async (c) => {
    const body = z.object({ shipmentIds: z.array(z.uuid()).min(1) }).parse(await c.req.json());
    const rows = await db.update(shipments).set({ codRemittedAt: new Date() })
      .where(inArray(shipments.id, body.shipmentIds)).returning({ id: shipments.id });
    return c.json({ updated: rows.length });
  });

  /* ── Inventory ── */
  r.get("/inventory", ops, async (c) => {
    const rows = await db.select({
      sku: variants.sku, product: products.name, colour: variants.colour, size: variants.size,
      onHand: sql<number>`coalesce(sum(${levels.onHand}), 0)::int`,
      reserved: sql<number>`coalesce(sum(${levels.reserved}), 0)::int`,
    }).from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .leftJoin(levels, eq(levels.variantId, variants.id))
      .groupBy(variants.id, products.name)
      .orderBy(products.name, variants.colour, variants.size);
    return c.json(rows.map((r) => ({ ...r, available: r.onHand - r.reserved })));
  });

  r.post("/inventory/receipts", managers, async (c) => {
    const body = z.object({
      lines: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive() })).min(1),
      reason: z.string().optional(), batchId: z.uuid().optional(), type: z.enum(["RECEIPT", "RETURN"]).default("RECEIPT"),
    }).parse(await c.req.json());
    await db.transaction(async (tx) => {
      const locationId = await getLocationId(tx, loc);
      const ids = await variantIdsBySku(tx, body.lines.map((l) => l.sku));
      for (const l of body.lines) {
        await addStock(tx, {
          variantId: ids.get(l.sku)!, locationId, quantity: l.quantity, type: body.type,
          reason: body.reason, batchId: body.batchId, staffId: c.get("staff").id,
        });
      }
    });
    return c.json({ ok: true }, 201);
  });

  r.post("/inventory/adjustments", managers, async (c) => {
    const body = z.object({
      sku: z.string(), delta: z.number().int(), reason: z.string().min(3), type: z.enum(["ADJUSTMENT", "WRITE_OFF"]).default("ADJUSTMENT"),
    }).parse(await c.req.json());
    await db.transaction(async (tx) => {
      const ids = await variantIdsBySku(tx, [body.sku]);
      await adjustStock(tx, {
        variantId: ids.get(body.sku)!, locationId: await getLocationId(tx, loc), delta: body.delta,
        type: body.type, reason: body.reason, staffId: c.get("staff").id,
      });
    });
    return c.json({ ok: true }, 201);
  });

  /* ── Catalogue ── */
  r.get("/products", ops, async (c) => c.json(await db.select().from(products).orderBy(products.name)));

  r.post("/products", managers, async (c) => {
    const body = productInput.parse(await c.req.json());
    const product = await db.transaction(async (tx) => {
      const [p] = await tx.insert(products).values({
        slug: body.slug, styleCode: body.styleCode, name: body.name, description: body.description,
        fabric: body.fabric, care: body.care, status: body.status,
      }).returning();
      await tx.insert(variants).values(body.variants.map((v) => ({ ...v, productId: p!.id })));
      if (body.images.length) {
        await tx.insert(productImages).values(body.images.map((img, i) => ({ ...img, productId: p!.id, position: i })));
      }
      return p!;
    });
    await triggerStorefrontRebuild(config.storefrontDeployHookUrl);
    return c.json(product, 201);
  });

  r.patch("/products/:id", managers, async (c) => {
    const body = productInput.omit({ variants: true, images: true }).partial().parse(await c.req.json());
    const [p] = await db.update(products).set(body).where(eq(products.id, c.req.param("id"))).returning();
    if (!p) throw notFound("Product");
    await triggerStorefrontRebuild(config.storefrontDeployHookUrl);
    return c.json(p);
  });

  /* ── Staff (owner only) ── */
  const owner = requireStaff(db, config, []);
  r.get("/staff", owner, async (c) => c.json(await db.select().from(staff).orderBy(staff.name)));
  r.post("/staff", owner, async (c) => {
    const body = z.object({
      cognitoSub: z.string().min(1), email: z.email(), name: z.string().min(1),
      role: z.enum(["ADMIN", "PACKER", "CUSTOMER_CARE"]),
    }).parse(await c.req.json());
    const [s] = await db.insert(staff).values(body).returning();
    return c.json(s, 201);
  });
  r.patch("/staff/:id", owner, async (c) => {
    const body = z.object({ role: z.enum(["ADMIN", "PACKER", "CUSTOMER_CARE"]).optional(), active: z.boolean().optional() })
      .parse(await c.req.json());
    const [s] = await db.update(staff).set(body).where(and(eq(staff.id, c.req.param("id")), sql`${staff.role} <> 'OWNER'`)).returning();
    if (!s) throw notFound("Staff member");
    return c.json(s);
  });

  return r;
}
