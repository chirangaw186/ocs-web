"use client";
import Link from "next/link";
import { formatLkr, orderTotals } from "@pavielle/shared";
import { cart, useCart } from "@/lib/cart";

export default function CartPage() {
  const items = useCart();
  if (items.length === 0) return <div className="container page"><p>Your bag is empty. <Link href="/">Continue shopping</Link></p></div>;
  const t = orderTotals(items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })));
  return (
    <div className="container page">
      <h1>Your bag</h1>
      <table>
        <tbody>
          {items.map((i) => (
            <tr key={i.sku}>
              <td><Link href={`/products/${i.slug}/`}>{i.name}</Link><br /><small>{i.colour} / {i.size}</small></td>
              <td>
                <select value={i.quantity} onChange={(e) => cart.setQuantity(i.sku, Number(e.target.value))} aria-label="Quantity">
                  {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? "Remove" : n}</option>)}
                </select>
              </td>
              <td>{formatLkr(i.price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Subtotal {formatLkr(t.subtotal)} · Delivery {t.delivery ? formatLkr(t.delivery) : "Free"}</p>
      <h3>Total {formatLkr(t.total)}</h3>
      <Link href="/checkout/" className="btn" style={{ justifySelf: "start" }}>Checkout</Link>
    </div>
  );
}
