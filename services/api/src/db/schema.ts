/**
 * Database schema. Each module owns its own Postgres schema, so a module can later be
 * moved into its own service/database without untangling shared tables.
 * Money is stored as integer minor units (LKR cents).
 */
import { sql } from "drizzle-orm";
import {
  pgSchema, uuid, text, integer, timestamp, boolean, jsonb, uniqueIndex, index, check, serial,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/* ───────────────────────── catalog ───────────────────────── */
export const catalog = pgSchema("catalog");
export const productStatus = catalog.enum("product_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);

export const products = catalog.table("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  styleCode: text("style_code").notNull().unique(),      // e.g. PV-HMD-01
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  fabric: text("fabric"),
  care: text("care"),
  sizeChart: jsonb("size_chart").$type<Record<string, Record<string, string>>>(), // size -> measurement -> value
  status: productStatus("status").notNull().default("DRAFT"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const variants = catalog.table("variants", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),                    // e.g. PV-HMD-01-BLS-M
  colour: text("colour").notNull(),
  size: text("size").notNull(),
  price: integer("price").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("variants_product_colour_size").on(t.productId, t.colour, t.size),
  check("variants_price_positive", sql`${t.price} > 0`),
]);

export const productImages = catalog.table("product_images", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  colour: text("colour"),
  position: integer("position").notNull().default(0),
});

/* ───────────────────────── inventory ───────────────────────── */
export const inventory = pgSchema("inventory");
export const movementType = inventory.enum("movement_type", [
  "RECEIPT",      // finished goods from a production batch
  "SALE",         // order confirmed and stock committed
  "RETURN",       // returned item put back into sellable stock
  "ADJUSTMENT",   // stock count correction (+/-)
  "WRITE_OFF",    // damaged / defective
]);
export const reservationStatus = inventory.enum("reservation_status", ["ACTIVE", "CONSUMED", "RELEASED"]);

export const locations = inventory.table("locations", {
  id: id(),
  code: text("code").notNull().unique(),                  // e.g. HOME, STORE-1
  name: text("name").notNull(),
});

/** Current levels. Kept in sync with the movements ledger inside the same transaction. */
export const levels = inventory.table("levels", {
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("levels_variant_location").on(t.variantId, t.locationId),
  check("levels_non_negative", sql`${t.onHand} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.onHand}`),
]);

/** Append-only ledger: every stock change is recorded here (audit trail). */
export const movements = inventory.table("movements", {
  id: id(),
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  type: movementType("type").notNull(),
  quantity: integer("quantity").notNull(),                 // signed
  reason: text("reason"),
  orderId: uuid("order_id"),
  batchId: uuid("batch_id"),
  staffId: uuid("staff_id"),
  createdAt: createdAt(),
}, (t) => [index("movements_variant_idx").on(t.variantId, t.createdAt)]);

export const reservations = inventory.table("reservations", {
  id: id(),
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  orderId: uuid("order_id").notNull(),
  quantity: integer("quantity").notNull(),
  status: reservationStatus("status").notNull().default("ACTIVE"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  index("reservations_active_expiry").on(t.status, t.expiresAt),
  index("reservations_order_idx").on(t.orderId),
]);

/* ───────────────────────── sales (orders, payments, shipments) ───────────────────────── */
export const sales = pgSchema("sales");
export const orderStatus = sales.enum("order_status", [
  "PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED", "PACKED", "DISPATCHED",
  "DELIVERED", "FAILED_DELIVERY", "RETURNED", "CANCELLED",
]);
export const paymentMethod = sales.enum("payment_method", ["PAYHERE", "COD", "BANK_TRANSFER"]);
export const paymentStatus = sales.enum("payment_status", ["INITIATED", "PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "CHARGEDBACK", "REFUNDED"]);

export const orders = sales.table("orders", {
  id: id(),
  number: serial("number").notNull().unique(),             // human-friendly: PV-1001
  status: orderStatus("status").notNull(),
  paymentMethod: paymentMethod("payment_method").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  district: text("district").notNull(),
  note: text("note"),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee").notNull(),
  total: integer("total").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("orders_status_created").on(t.status, t.createdAt)]);

export const orderLines = sales.table("order_lines", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  sku: text("sku").notNull(),                               // snapshot at time of sale
  name: text("name").notNull(),
  colour: text("colour").notNull(),
  size: text("size").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const orderEvents = sales.table("order_events", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  note: text("note"),
  staffId: uuid("staff_id"),
  createdAt: createdAt(),
});

export const payments = sales.table("payments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  method: paymentMethod("method").notNull(),
  status: paymentStatus("status").notNull(),
  amount: integer("amount").notNull(),
  providerRef: text("provider_ref"),                        // PayHere payment_id
  raw: jsonb("raw"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("payments_method_ref").on(t.method, t.providerRef)]);

export const shipments = sales.table("shipments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  courier: text("courier").notNull(),                       // Domex, Koombiyo, ...
  trackingNumber: text("tracking_number"),
  codAmount: integer("cod_amount").notNull().default(0),
  codRemittedAt: timestamp("cod_remitted_at", { withTimezone: true }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ───────────────────────── people (customers, staff) ───────────────────────── */
export const people = pgSchema("people");
export const staffRole = people.enum("staff_role", ["OWNER", "ADMIN", "PACKER", "CUSTOMER_CARE"]);

export const customers = people.table("customers", {
  id: id(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  prepayOnly: boolean("prepay_only").notNull().default(false), // set after repeated failed COD
  createdAt: createdAt(),
});

export const staff = people.table("staff", {
  id: id(),
  cognitoSub: text("cognito_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: staffRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/* ───────────────────────── production (suppliers, batches) ───────────────────────── */
export const production = pgSchema("production");

export const suppliers = production.table("suppliers", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),                             // TAILOR, FABRIC, TRIMS
  phone: text("phone"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const batches = production.table("batches", {
  id: id(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  reference: text("reference").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const batchLines = production.table("batch_lines", {
  id: id(),
  batchId: uuid("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => variants.id),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(),                 // fully loaded cost per unit (minor units)
});
