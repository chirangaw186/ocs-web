import { asc, eq, inArray } from "drizzle-orm";
import type { StoreProduct } from "@pavielle/shared";
import type { Db } from "../../db/client.js";
import { productImages, products, variants } from "../../db/schema.js";
import { availability } from "../inventory/service.js";

export async function listStoreProducts(db: Db, slug?: string): Promise<StoreProduct[]> {
  const prods = await db.select().from(products)
    .where(slug ? eq(products.slug, slug) : eq(products.status, "ACTIVE"))
    .orderBy(asc(products.createdAt));
  const active = prods.filter((p) => p.status === "ACTIVE");
  if (active.length === 0) return [];
  const ids = active.map((p) => p.id);
  const [vars, imgs] = await Promise.all([
    db.select().from(variants).where(inArray(variants.productId, ids)),
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position)),
  ]);
  const avail = await availability(db, vars.map((v) => v.id));
  return active.map((p) => ({
    slug: p.slug, name: p.name, description: p.description, fabric: p.fabric, care: p.care,
    images: imgs.filter((i) => i.productId === p.id).map((i) => ({ url: i.url, alt: i.alt })),
    variants: vars.filter((v) => v.productId === p.id && v.active).map((v) => ({
      sku: v.sku, colour: v.colour, size: v.size, price: v.price, available: Math.max(0, avail.get(v.id) ?? 0),
    })),
  }));
}

/** Tell Cloudflare Pages to rebuild the static storefront after catalogue changes. */
export async function triggerStorefrontRebuild(hookUrl?: string) {
  if (!hookUrl) return;
  try {
    await fetch(hookUrl, { method: "POST", signal: AbortSignal.timeout(3000) });
  } catch (err) {
    console.warn("Storefront rebuild hook failed", err);
  }
}
