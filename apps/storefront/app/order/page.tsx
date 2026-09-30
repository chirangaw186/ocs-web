"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatLkr } from "@pavielle/shared";
import { PUBLIC_API } from "@/lib/api";

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Waiting for payment confirmation…",
  AWAITING_CONFIRMATION: "Order received. We'll contact you shortly to confirm.",
  CONFIRMED: "Confirmed. We're preparing your order.",
  PACKED: "Packed and ready for dispatch.",
  DISPATCHED: "On its way.",
  DELIVERED: "Delivered.",
  CANCELLED: "This order was cancelled.",
};

function OrderStatus() {
  const ref = useSearchParams().get("ref");
  const [order, setOrder] = useState<{ orderRef: string; status: string; total: number }>();
  useEffect(() => {
    let saved: { ref: string; phone: string } | undefined;
    try { saved = JSON.parse(sessionStorage.getItem("pavielle.lastOrder") ?? "null") ?? undefined; } catch { /* ignore */ }
    if (!ref || saved?.ref !== ref) return;
    let tries = 0;
    const load = () => fetch(`${PUBLIC_API}/store/orders/${ref}?phone=${encodeURIComponent(saved!.phone)}`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((o) => {
        setOrder(o);
        // PayHere's server callback can arrive a few seconds after the browser returns.
        if (o?.status === "PENDING_PAYMENT" && tries++ < 10) setTimeout(load, 3000);
      });
    load();
  }, [ref]);

  return (
    <div className="container page">
      <h1>Thank you</h1>
      {ref && <p>Order reference: <strong>{ref}</strong></p>}
      {order && <p>{LABELS[order.status] ?? order.status} · {formatLkr(order.total)}</p>}
    </div>
  );
}

export default function OrderPage() {
  return <Suspense><OrderStatus /></Suspense>;
}
