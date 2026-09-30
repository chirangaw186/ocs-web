"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { BagIcon } from "./Icons";

export function CartLink() {
  const count = useCart().reduce((n, i) => n + i.quantity, 0);
  return (
    <Link href="/cart/" className="bag" aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`}>
      <BagIcon /><span>{count}</span>
    </Link>
  );
}
