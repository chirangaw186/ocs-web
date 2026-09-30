import type { StoreProduct } from "@pavielle/shared";
import { sampleProducts } from "./fixtures";

export const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Build-time catalogue fetch. */
export async function getProducts(): Promise<StoreProduct[]> {
  const base = process.env.API_URL;
  if (!base) return sampleProducts;
  const res = await fetch(`${base}/store/products`);
  if (!res.ok) throw new Error(`Catalogue fetch failed: ${res.status}`);
  return res.json();
}

export async function getProduct(slug: string) {
  return (await getProducts()).find((p) => p.slug === slug);
}
