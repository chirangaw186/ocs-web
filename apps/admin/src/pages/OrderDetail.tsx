import { useState } from "react";
import { useParams } from "react-router";
import { formatLkr } from "@pavielle/shared";
import { api } from "../api";
import { useApi } from "../useApi";

/** Mirrors TRANSITIONS in the API; the API is the source of truth and rejects anything else. */
const NEXT: Record<string, string[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["DISPATCHED", "RETURNED"],
  DELIVERED: ["RETURNED"],
};

interface Order {
  id: string; ref: string; status: string; paymentMethod: string; total: number; subtotal: number; deliveryFee: number;
  firstName: string; lastName: string; phone: string; email: string; addressLine1: string; addressLine2?: string; city: string; district: string; note?: string;
  lines: { id: string; name: string; sku: string; colour: string; size: string; quantity: number; unitPrice: number }[];
  events: { id: string; fromStatus?: string; toStatus: string; note?: string; createdAt: string }[];
  payments: { id: string; status: string; providerRef?: string; amount: number }[];
  shipments: { id: string; courier: string; trackingNumber?: string }[];
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { data: o, error, reload } = useApi<Order>(`/orders/${id}`);
  const [msg, setMsg] = useState<string>();
  const act = (fn: () => Promise<unknown>) => fn().then(() => { setMsg(undefined); reload(); }, (e: Error) => setMsg(e.message));

  if (error) return <p className="error">{error}</p>;
  if (!o) return <p>Loading…</p>;
  return (
    <>
      <h1>{o.ref} · {o.status}</h1>
      <p>{o.firstName} {o.lastName} · <a href={`https://wa.me/94${o.phone.replace(/^(\+94|0)/, "")}`}>{o.phone}</a> · {o.email}<br />
        {o.addressLine1}{o.addressLine2 ? `, ${o.addressLine2}` : ""}, {o.city}, {o.district}</p>
      {o.note && <p><em>Note: {o.note}</em></p>}
      <table>
        <tbody>
          {o.lines.map((l) => <tr key={l.id}><td>{l.name}</td><td>{l.sku}</td><td>{l.colour}/{l.size}</td><td>×{l.quantity}</td><td>{formatLkr(l.unitPrice * l.quantity)}</td></tr>)}
          <tr><td colSpan={4}>Delivery</td><td>{formatLkr(o.deliveryFee)}</td></tr>
          <tr><th colSpan={4}>Total ({o.paymentMethod})</th><th>{formatLkr(o.total)}</th></tr>
        </tbody>
      </table>
      <div className="row">
        {(NEXT[o.status] ?? []).map((to) => (
          <button key={to} className={to === "CANCELLED" ? "" : "primary"}
            onClick={() => (to !== "CANCELLED" || confirm("Cancel this order?")) && act(() => api(`/orders/${o.id}/transition`, { method: "POST", body: { to } }))}>
            {to === "CONFIRMED" && o.paymentMethod !== "PAYHERE" ? "Confirmed with customer" : `Mark ${to.toLowerCase().replace("_", " ")}`}
          </button>
        ))}
      </div>
      {(o.status === "PACKED" || o.status === "CONFIRMED") && <ShipmentForm orderId={o.id} onDone={reload} />}
      {msg && <p className="error">{msg}</p>}
      <h3>Shipments</h3>
      <ul>{o.shipments.map((s) => <li key={s.id}>{s.courier} {s.trackingNumber}</li>)}</ul>
      <h3>Payments</h3>
      <ul>{o.payments.map((p) => <li key={p.id}>{p.status} {formatLkr(p.amount)} {p.providerRef}</li>)}</ul>
      <h3>History</h3>
      <ul>{o.events.map((e) => <li key={e.id}>{new Date(e.createdAt).toLocaleString()}: {e.fromStatus ? `${e.fromStatus} → ` : ""}{e.toStatus} {e.note && `— ${e.note}`}</li>)}</ul>
    </>
  );
}

function ShipmentForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [courier, setCourier] = useState("Domex");
  const [tracking, setTracking] = useState("");
  return (
    <div className="row">
      <select value={courier} onChange={(e) => setCourier(e.target.value)}>
        {["Domex", "Koombiyo", "Citypak", "Prompt Xpress", "Pronto"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
      <button onClick={() => api(`/orders/${orderId}/shipments`, { method: "POST", body: { courier, trackingNumber: tracking || undefined } }).then(onDone)}>
        Add shipment
      </button>
    </div>
  );
}
