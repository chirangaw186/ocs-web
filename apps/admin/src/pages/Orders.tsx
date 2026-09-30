import { useState } from "react";
import { Link } from "react-router";
import { formatLkr, ORDER_STATUSES } from "@pavielle/shared";
import { useApi } from "../useApi";

interface OrderRow { id: string; ref: string; status: string; paymentMethod: string; firstName: string; lastName: string; phone: string; district: string; total: number; createdAt: string }

export function OrdersPage() {
  const [status, setStatus] = useState("AWAITING_CONFIRMATION,CONFIRMED,PACKED");
  const { data, error } = useApi<OrderRow[]>(`/orders${status ? `?status=${status}` : ""}`);
  return (
    <>
      <h1>Orders</h1>
      <div className="row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="AWAITING_CONFIRMATION,CONFIRMED,PACKED">To action</option>
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>District</th><th>Payment</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
        <tbody>
          {data?.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/orders/${o.id}`}>{o.ref}</Link></td>
              <td>{o.firstName} {o.lastName}<br /><small>{o.phone}</small></td>
              <td>{o.district}</td><td>{o.paymentMethod}</td><td>{o.status}</td>
              <td>{formatLkr(o.total)}</td><td>{new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
