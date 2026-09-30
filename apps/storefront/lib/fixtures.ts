import type { StoreProduct } from "@pavielle/shared";

/** Used when API_URL is not set at build time (CI, first local run). */
const sizes = ["XS", "S", "M", "L", "XL"];
const make = (slug: string, name: string, code: string, price: number, colours: [string, string][], fabric: string): StoreProduct => ({
  slug, name, fabric, care: "Hand wash cold.", description: `${name} in soft pastel tones.`,
  images: [], // tiles use the fabric colour until real photos exist
  variants: colours.flatMap(([colour, c]) => sizes.map((size) => ({ sku: `${code}-${c}-${size}`, colour, size, price, available: 3 }))),
});

export const sampleProducts: StoreProduct[] = [
  make("soft-midi-dress", "Soft Midi Dress", "PV-SMD-01", 1_190_000, [["Blush", "BLS"], ["Ivory", "IVY"]], "Premium crepe, fully lined"),
  make("flowing-maxi", "Flowing Maxi", "PV-FMX-01", 1_290_000, [["Powder Blue", "PBL"], ["Sage", "SGE"]], "Georgette with lining"),
];
