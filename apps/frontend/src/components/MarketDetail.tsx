import type { Market, OrderBookLevel } from "../types";

interface Props { market: Market; onBack: () => void }
const cents = (price?: number) => price == null ? "—" : `${price}¢`;

function Book({ title, bids, asks }: { title: string; bids: OrderBookLevel[]; asks: OrderBookLevel[] }) {
  const spread = bids[0] && asks[0] ? asks[0].price - bids[0].price : null;
  return <section className="book-card">
    <div className="book-card-header"><div><h3>{title}</h3><p>{cents(bids[0]?.price)} bid · {cents(asks[0]?.price)} ask</p></div><span className="spread-pill">Spread {spread == null ? "—" : `${spread}¢`}</span></div>
    <div className="book-table"><div className="book-row book-head"><span>Price</span><span>Shares</span><span>Orders</span></div>
      <div className="book-side-label ask-label">Asks</div>
      {[...asks].slice(0, 7).reverse().map((level) => <div className="book-row ask-row" key={`ask-${level.price}`}><span>{cents(level.price)}</span><span>{level.quantity.toLocaleString()}</span><span>{level.orderCount}</span></div>)}
      {!asks.length && <div className="empty-book-row">No asks yet</div>}
      <div className="spread-row"><span>Mid market</span><strong>{spread == null ? "—" : `${Math.round((bids[0]!.price + asks[0]!.price) / 2)}¢`}</strong></div>
      <div className="book-side-label bid-label">Bids</div>
      {bids.slice(0, 7).map((level) => <div className="book-row bid-row" key={`bid-${level.price}`}><span>{cents(level.price)}</span><span>{level.quantity.toLocaleString()}</span><span>{level.orderCount}</span></div>)}
      {!bids.length && <div className="empty-book-row">No bids yet</div>}
    </div>
  </section>;
}

export function MarketDetail({ market, onBack }: Props) {
  const yes = market.orderBook.YES, no = market.orderBook.NO;
  return <div className="market-detail">
    <button onClick={onBack} className="back-button">← All markets</button>
    <section className="market-hero"><div className="market-hero-copy"><span className="eyebrow">{market.category} · {market.status}</span><h2>{market.title}</h2><p>{market.description}</p></div>
      <div className="outcome-cards"><div className="outcome-card yes-outcome"><span>Yes</span><strong>{cents(yes.asks[0]?.price ?? yes.bids[0]?.price)}</strong><small>Bid {cents(yes.bids[0]?.price)} · Ask {cents(yes.asks[0]?.price)}</small></div><div className="outcome-card no-outcome"><span>No</span><strong>{cents(no.asks[0]?.price ?? no.bids[0]?.price)}</strong><small>Bid {cents(no.bids[0]?.price)} · Ask {cents(no.asks[0]?.price)}</small></div></div>
    </section>
    <section className="resolution-card"><span>Resolution criteria</span><p>{market.resolutionDescription}</p></section>
    <div className="orderbooks-container"><Book title="YES order book" {...yes} /><Book title="NO order book" {...no} /></div>
  </div>;
}
