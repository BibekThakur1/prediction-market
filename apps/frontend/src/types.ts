export type Outcome = "YES" | "NO";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  YES: { bids: OrderBookLevel[]; asks: OrderBookLevel[] };
  NO: { bids: OrderBookLevel[]; asks: OrderBookLevel[] };
}

export interface Market {
  id: string;
  title: string;
  description: string;
  resolutionDescription: string;
  category: string;
  status: "OPEN" | "CLOSED" | "RESOLVED" | "CANCELLED";
  closesAt: string | null;
  createdAt: string;
  orderBook: OrderBook;
}

export interface Position {
  id: string;
  marketId: string;
  outcome: Outcome;
  availableQty: number;
  reservedQty: number;
  market: { title: string; status: Market["status"] };
}

export interface Order {
  id: string;
  marketId: string;
  outcome: Outcome;
  side: OrderSide;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  createdAt: string;
  market: { title: string };
}

export interface Account {
  id: string;
  address: string;
  availableBalance: number;
  reservedBalance: number;
}
