import { useEffect, useState } from "react";
import { api } from "../api";
import type { Account } from "../types";

export function Balance({ token }: { token: string }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState("25");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => setAccount((await api.me(token)).user);
  useEffect(() => { api.me(token).then((data) => setAccount(data.user)).catch((err) => setError(err instanceof Error ? err.message : "Could not load balances")); }, [token]);
  async function move(type: "deposit" | "withdraw") {
    const value = Number(amount); if (!Number.isFinite(value) || value <= 0) return setMessage("Enter a positive amount.");
    try { setLoading(true); setMessage(""); setError(""); await api[type](token, value); await load(); setMessage(`${type === "deposit" ? "Added" : "Withdrew"} $${value.toFixed(2)} test credits.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Transfer failed"); } finally { setLoading(false); }
  }
  if (!account) return <div className="balance-section" aria-live="polite">{error ? <><div className="error" role="alert">{error}</div><button className="refresh-button" onClick={() => { setError(""); void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load balances")); }}>Try again</button></> : "Loading balances…"}</div>;
  return <section className="balance-section"><span className="eyebrow">Testnet wallet</span><h3>Funds</h3>
    <div className="balance-grid"><div className="balance-display"><span>Available</span><strong>${(account.availableBalance / 100).toFixed(2)}</strong><small>Ready to trade or withdraw</small></div><div className="balance-display reserved"><span>Reserved</span><strong>${(account.reservedBalance / 100).toFixed(2)}</strong><small>Backing open buy orders</small></div></div>
    {message && <div className="success" role="status">{message}</div>}{error && <div className="error" role="alert">{error}</div>}
    <div className="balance-actions"><div className="form-group"><label htmlFor="fund-amount">Amount in test USD</label><input id="fund-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><button onClick={() => move("deposit")} disabled={loading}>Add credits</button><button onClick={() => move("withdraw")} disabled={loading}>Withdraw</button></div>
  </section>;
}
