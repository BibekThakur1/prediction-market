import { useState } from "react";
import { api } from "../api";
import type { Market } from "../types";

export function SplitMerge({ market, token, availableBalance, onActionComplete }: { market: Market; token: string; availableBalance: number; onActionComplete: () => void }) {
  const [quantity, setQuantity] = useState("10"), [loading, setLoading] = useState(false), [message, setMessage] = useState("");
  async function run(action: "split" | "merge") { const value = Math.floor(Number(quantity)); if (value < 1) return setMessage("Enter at least one share."); try { setLoading(true); setMessage(""); await api[action](token, market.id, value); setMessage(action === "split" ? `Created ${value} YES + NO pairs.` : `Merged ${value} complete sets.`); onActionComplete(); } catch (err) { setMessage(err instanceof Error ? err.message : "Action failed"); } finally { setLoading(false); } }
  return <section className="trade-card split-merge-section"><div className="trade-card-header"><div><span>Complete sets</span><h3>Split / Merge</h3></div><span>$1 per pair</span></div>
    {message && <div className="success" role="status">{message}</div>}<div className="form-group"><label htmlFor="set-quantity">Complete sets</label><input id="set-quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="set-summary"><span>Split cost</span><strong>${(Math.max(0, Number(quantity) || 0)).toFixed(2)}</strong><small>${(availableBalance / 100).toFixed(2)} available</small></div><p className="reserve-note">Split converts $1 into one YES and one NO. Merge does the reverse.</p><div className="split-merge-actions"><button disabled={loading} onClick={() => run("split")}>Split into shares</button><button disabled={loading} onClick={() => run("merge")}>Merge to cash</button></div>
  </section>;
}
