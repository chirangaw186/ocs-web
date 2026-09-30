import { useState } from "react";
import { api } from "../api";
import { useApi } from "../useApi";

interface Row { sku: string; product: string; colour: string; size: string; onHand: number; reserved: number; available: number }

export function InventoryPage() {
  const { data, error, reload } = useApi<Row[]>("/inventory");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"RECEIPT" | "RETURN" | "ADJUSTMENT" | "WRITE_OFF">("RECEIPT");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string>();

  async function submit() {
    try {
      if (mode === "RECEIPT" || mode === "RETURN") {
        await api("/inventory/receipts", { method: "POST", body: { type: mode, lines: [{ sku, quantity: qty }], reason: reason || undefined } });
      } else {
        await api("/inventory/adjustments", { method: "POST", body: { sku, type: mode, delta: mode === "WRITE_OFF" ? -Math.abs(qty) : qty, reason } });
      }
      setMsg("Saved"); reload();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <>
      <h1>Inventory</h1>
      <div className="row">
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="RECEIPT">Receive from production</option>
          <option value="RETURN">Customer return (restock)</option>
          <option value="ADJUSTMENT">Count adjustment (+/-)</option>
          <option value="WRITE_OFF">Write off (damaged)</option>
        </select>
        <input list="skus" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <datalist id="skus">{data?.map((r) => <option key={r.sku} value={r.sku} />)}</datalist>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 80 }} />
        <input placeholder="Reason / batch ref" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="primary" disabled={!sku || !qty} onClick={submit}>Save</button>
        {msg && <span>{msg}</span>}
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Product</th><th>SKU</th><th>Colour</th><th>Size</th><th>On hand</th><th>Reserved</th><th>Available</th></tr></thead>
        <tbody>
          {data?.map((r) => (
            <tr key={r.sku}>
              <td>{r.product}</td><td>{r.sku}</td><td>{r.colour}</td><td>{r.size}</td>
              <td>{r.onHand}</td><td>{r.reserved}</td><td className={r.available <= 1 ? "low" : ""}>{r.available}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
