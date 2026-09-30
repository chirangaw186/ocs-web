"use client";
import { useSyncExternalStore } from "react";

export interface CartItem { sku: string; name: string; colour: string; size: string; price: number; quantity: number; slug: string }
const KEY = "pavielle.cart";
const listeners = new Set<() => void>();
let cache: CartItem[] | undefined;

function read(): CartItem[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}
function write(items: CartItem[]) {
  cache = items;
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export const cart = {
  add(item: CartItem) {
    const items = read();
    const existing = items.find((i) => i.sku === item.sku);
    write(existing
      ? items.map((i) => (i.sku === item.sku ? { ...i, quantity: Math.min(10, i.quantity + item.quantity) } : i))
      : [...items, item]);
  },
  setQuantity(sku: string, quantity: number) {
    write(quantity <= 0 ? read().filter((i) => i.sku !== sku) : read().map((i) => (i.sku === sku ? { ...i, quantity } : i)));
  },
  clear: () => write([]),
};

const EMPTY: CartItem[] = [];
export function useCart() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => EMPTY,
  );
}
