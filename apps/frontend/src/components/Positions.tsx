import { useEffect, useState } from "react";
import { api } from "../api";
import type { Position } from "../types";

export function Positions({ token }: { token: string }) {
  const [positions, setPositions] = useState<Position[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api.positions(token).then((data) => setPositions(data.positions)).catch((err) => setError(err instanceof Error ? err.message : "Could not load positions")).finally(() => setLoading(false)); }, [token]);
  if (loading) return <div className="positions-section">Loading portfolio…</div>;
  return <section className="positions-section"><span className="eyebrow">Portfolio</span><h3>Your positions</h3>
    {error && <div className="error" role="alert">{error}</div>}
    {!positions.length ? <div className="empty-state">You do not own any shares yet. Split $1 into one YES and one NO share, or place a buy order.</div> : <div className="table-wrap"><table className="positions-table"><thead><tr><th>Market</th><th>Outcome</th><th>Available</th><th>Reserved</th><th>Total</th></tr></thead><tbody>{positions.map((position) => <tr key={position.id}><td className="market-cell"><span className="market-title">{position.market.title}</span><span className="market-id">{position.market.status}</span></td><td className={position.outcome.toLowerCase()}>{position.outcome}</td><td>{position.availableQty}</td><td>{position.reservedQty}</td><td>{position.availableQty + position.reservedQty}</td></tr>)}</tbody></table></div>}
  </section>;
}
