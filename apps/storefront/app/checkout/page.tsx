"use client";
import { useState } from "react";
import { formatLkr, orderTotals, type PaymentMethod } from "@pavielle/shared";
import { PUBLIC_API } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";

type PayHereForm = { action: string; fields: Record<string, string> };

/** PayHere is a redirect: build a hidden form and submit it. */
function submitToPayHere(p: PayHereForm) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = p.action;
  for (const [name, value] of Object.entries(p.fields)) {
    const input = document.createElement("input");
    input.type = "hidden"; input.name = name; input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function CheckoutPage() {
  const items = useCart();
  const [method, setMethod] = useState<PaymentMethod>("PAYHERE");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const t = orderTotals(items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch(`${PUBLIC_API}/store/checkout`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        customer: { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone },
        address: { line1: f.line1, line2: f.line2 || undefined, city: f.city, district: f.district },
        paymentMethod: method, note: f.note || undefined,
      }),
    }).catch(() => undefined);
    const body = await res?.json().catch(() => undefined);
    if (!res || !res.ok) {
      setBusy(false);
      setError(body?.message ?? (body?.error === "validation_error" ? "Please check your details." : "Could not place the order. Please try again."));
      return;
    }
    try { sessionStorage.setItem("pavielle.lastOrder", JSON.stringify({ ref: body.orderRef, phone: f.phone })); } catch { /* ignore */ }
    cart.clear();
    if (body.payment) submitToPayHere(body.payment);
    else window.location.href = `/order/?ref=${body.orderRef}`;
  }

  if (items.length === 0) return <div className="container page"><p>Your bag is empty.</p></div>;
  return (
    <div className="container page">
      <h1>Checkout</h1>
      <form className="stack" onSubmit={onSubmit}>
        <input name="firstName" placeholder="First name" required autoComplete="given-name" />
        <input name="lastName" placeholder="Last name" required autoComplete="family-name" />
        <input name="phone" placeholder="Mobile (07X XXX XXXX)" required autoComplete="tel" />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input name="line1" placeholder="Address" required autoComplete="address-line1" />
        <input name="line2" placeholder="Apartment, landmark (optional)" autoComplete="address-line2" />
        <input name="city" placeholder="City" required autoComplete="address-level2" />
        <input name="district" placeholder="District" required />
        <textarea name="note" placeholder="Note (optional)" rows={2} />
        <fieldset>
          <legend>Payment</legend>
          {([["PAYHERE", "Card / online payment (PayHere)"], ["COD", "Cash on delivery"], ["BANK_TRANSFER", "Bank transfer"]] as const).map(([v, label]) => (
            <label key={v} style={{ display: "block" }}>
              <input type="radio" name="method" style={{ width: "auto" }} checked={method === v} onChange={() => setMethod(v)} /> {label}
            </label>
          ))}
          {method === "COD" && <small>We will call or WhatsApp you to confirm before dispatch.</small>}
        </fieldset>
        <p>Total {formatLkr(t.total)} {t.delivery ? `(incl. ${formatLkr(t.delivery)} delivery)` : "(free delivery)"}</p>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Placing order…" : method === "PAYHERE" ? "Pay now" : "Place order"}</button>
      </form>
    </div>
  );
}
