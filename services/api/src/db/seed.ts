/** Local/dev seed: a stock location, an owner account and two sample products with stock. */
import { rs } from "@pavielle/shared";
import { loadConfig } from "../config.js";
import { closeDb, getDb } from "./client.js";
import { locations, staff, products, variants } from "./schema.js";
import { addStock } from "../modules/inventory/service.js";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;
const RATIO = { XS: 1, S: 3, M: 4, L: 3, XL: 1 } as const;

const catalogue = [
  { slug: "soft-midi-dress", styleCode: "PV-SMD-01", name: "Soft Midi Dress", fabric: "Premium crepe, fully lined",
    care: "Hand wash cold. Do not tumble dry.", price: rs(11_900), colours: { Blush: "BLS", Ivory: "IVY" } },
  { slug: "flowing-maxi", styleCode: "PV-FMX-01", name: "Flowing Maxi", fabric: "Georgette with lining",
    care: "Hand wash cold. Cool iron.", price: rs(12_900), colours: { "Powder Blue": "PBL", Sage: "SGE" } },
];

export async function seed(db = getDb()) {
  await db.transaction(async (tx) => {
    const [loc] = await tx.insert(locations).values({ code: "HOME", name: "Home studio" })
      .onConflictDoUpdate({ target: locations.code, set: { name: "Home studio" } }).returning();
    await tx.insert(staff).values({ cognitoSub: "dev-owner", email: "owner@pavielle.test", name: "Owner", role: "OWNER" })
      .onConflictDoNothing();
    for (const item of catalogue) {
      const [p] = await tx.insert(products).values({
        slug: item.slug, styleCode: item.styleCode, name: item.name, fabric: item.fabric, care: item.care,
        description: `${item.name} in soft pastel tones.`, status: "ACTIVE",
      }).onConflictDoNothing().returning();
      if (!p) continue;
      for (const [colour, code] of Object.entries(item.colours)) {
        for (const size of SIZES) {
          const [v] = await tx.insert(variants).values({
            productId: p.id, sku: `${item.styleCode}-${code}-${size}`, colour, size, price: item.price,
          }).returning();
          await addStock(tx, { variantId: v!.id, locationId: loc!.id, quantity: RATIO[size], type: "RECEIPT", reason: "Seed" });
        }
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = await loadConfig();
  await seed(getDb(config.databaseUrl));
  await closeDb();
  console.log("Seeded");
}
