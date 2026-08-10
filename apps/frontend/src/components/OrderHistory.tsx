import { useEffect, useState } from "react";
import { api } from "../api";
import type { Order } from "../types";

export function OrderHistory({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = async () => { try { setOrders((await api.orders(token)).orders); } finally { setLoading(false); } };
  useEffect(() => { api.orders(token).then((data) => setOrders(data.orders)).catch((err) => setError(err instanceof Error ? err.message : "Could not load orders")).finally(() => setLoading(false)); }, [token]);
  async function cancel(orderId: string) { try { await api.cancelOrder(token, orderId); await load(); onChanged(); } catch (err) { setError(err instanceof Error ? err.message : "Cancellation failed"); } }
  if (loading) return <div className="history-section">Loading orders…</div>;
  return <section className="history-section"><span className="eyebrow">Order management</span><h3>Your orders</h3>{error && <div className="error">{error}</div>}
    {!orders.length ? <div className="empty-state">No orders yet.</div> : <div className="table-wrap"><table className="history-table"><thead><tr><th>Market</th><th>Order</th><th>Price</th><th>Filled</th><th>Status</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="market-cell"><span className="market-title">{order.market.title}</span><span className="market-id">{new Date(order.createdAt).toLocaleString()}</span></td><td className={order.side.toLowerCase()}>{order.side} {order.outcome}</td><td>{order.price}¢</td><td>{order.filledQuantity} / {order.quantity}</td><td><span className={`status-badge ${order.status.toLowerCase()}`}>{order.status.replace("_", " ")}</span></td><td>{["OPEN","PARTIALLY_FILLED"].includes(order.status) && <button className="cancel-button" onClick={() => cancel(order.id)}>Cancel</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}
