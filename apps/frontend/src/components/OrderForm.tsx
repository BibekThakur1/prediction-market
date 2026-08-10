import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Market, OrderSide, Outcome } from "../types";

interface Props { market: Market; token: string; availableBalance: number; onOrderPlaced: () => void }

export function OrderForm({ market, token, availableBalance, onOrderPlaced }: Props) {
  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [price, setPrice] = useState("50");
  const [quantity, setQuantity] = useState("10");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const suggested = useMemo(() => side === "BUY" ? market.orderBook[outcome].asks[0]?.price : market.orderBook[outcome].bids[0]?.price, [market, outcome, side]);
  const parsedPrice = Math.floor(Number(price)), parsedQty = Math.floor(Number(quantity));

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(null);
    if (parsedPrice < 1 || parsedPrice > 99 || parsedQty < 1) return setMessage({ type: "error", text: "Enter a price from 1–99¢ and at least one share." });
    try { setLoading(true); await api.placeOrder(token, { marketId: market.id, outcome, side, price: parsedPrice, quantity: parsedQty }); setMessage({ type: "success", text: "Order accepted and matched safely." }); onOrderPlaced(); }
    catch (err) { setMessage({ type: "error", text: err instanceof Error ? err.message : "Order failed" }); }
    finally { setLoading(false); }
  }

  return <section className="trade-card order-form"><div className="trade-card-header"><div><span>Limit order</span><h3>{side} {outcome}</h3></div><div className="buying-power"><span>Buying power</span><strong>${(availableBalance / 100).toFixed(2)}</strong></div></div>
    <form onSubmit={submit}>
      {message && <div className={message.type} role="status">{message.text}</div>}
      <div className="segmented-control">{(["BUY","SELL"] as const).map((value) => <button type="button" key={value} className={side === value ? "active" : ""} onClick={() => setSide(value)}>{value === "BUY" ? "Buy" : "Sell"}</button>)}</div>
      <div className="outcome-toggle">{(["YES","NO"] as const).map((value) => <button type="button" key={value} className={outcome === value ? `active ${value === "YES" ? "yes-active" : "no-active"}` : ""} onClick={() => setOutcome(value)}>{value}</button>)}</div>
      <div className="form-group"><label htmlFor="price">Limit price (cents)</label><input id="price" type="number" min="1" max="99" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
      <div className="form-group"><label htmlFor="quantity">Shares</label><input id="quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
      <div className="trade-summary"><div><span>Best market price</span><strong>{suggested ? `${suggested}¢` : "—"}</strong></div><div><span>{side === "BUY" ? "Max cost" : "Proceeds"}</span><strong>${((parsedPrice * parsedQty || 0) / 100).toFixed(2)}</strong></div></div>
      <p className="reserve-note">{side === "BUY" ? "Cash" : `${outcome} shares`} will be reserved until filled or cancelled.</p>
      <button className={`primary-action ${outcome === "NO" ? "no-action" : ""}`} disabled={loading || market.status !== "OPEN"}>{loading ? "Submitting order…" : `${side === "BUY" ? "Buy" : "Sell"} ${outcome} · $${((parsedPrice * parsedQty || 0) / 100).toFixed(2)}`}</button>
    </form>
  </section>;
}
