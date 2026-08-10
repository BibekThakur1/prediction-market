import { useMemo, useState } from "react";
import type { Market } from "../types";

interface Props { markets: Market[]; onSelectMarket: (marketId: string) => void }
const cents = (price?: number) => price == null ? "—" : `${price}¢`;

export function MarketList({ markets, onSelectMarket }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(markets.map((market) => market.category))];
  const filtered = useMemo(() => markets.filter((market) =>
    (category === "All" || market.category === category) &&
    `${market.title} ${market.description}`.toLowerCase().includes(query.toLowerCase()),
  ), [markets, query, category]);

  return <section className="market-list">
    <div className="section-heading"><div><span className="eyebrow">Live markets</span><h2>What will happen next?</h2></div><span className="count-pill">{filtered.length} markets</span></div>
    <div className="market-toolbar">
      <label className="search-field"><span className="sr-only">Search markets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets" /></label>
      <div className="category-filter" aria-label="Filter by category">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    </div>
    {filtered.length === 0 ? <div className="empty-state">No markets match your filters.</div> : <div className="markets-grid">
      {filtered.map((market) => {
        const yes = market.orderBook.YES;
        const no = market.orderBook.NO;
        return <button key={market.id} className="market-card" onClick={() => onSelectMarket(market.id)}>
          <div className="market-card-top"><span className="market-status">{market.status}</span><span className="market-liquidity">{market.category}</span></div>
          <h3>{market.title}</h3><p>{market.description}</p>
          <div className="market-card-actions"><span className="price-chip yes-chip">Yes {cents(yes.asks[0]?.price ?? yes.bids[0]?.price)}</span><span className="price-chip no-chip">No {cents(no.asks[0]?.price ?? no.bids[0]?.price)}</span></div>
        </button>;
      })}
    </div>}
  </section>;
}
