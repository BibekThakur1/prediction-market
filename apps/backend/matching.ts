export type MatchableOrder = {
  id: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filledQuantity: number;
  createdAt: Date;
};

export function remainingQuantity(order: Pick<MatchableOrder, "quantity" | "filledQuantity">) {
  return order.quantity - order.filledQuantity;
}

export function statusAfterFill(quantity: number, filledQuantity: number) {
  if (filledQuantity === 0) return "OPEN" as const;
  if (filledQuantity < quantity) return "PARTIALLY_FILLED" as const;
  return "FILLED" as const;
}

export function pricesCross(takerSide: "BUY" | "SELL", takerPrice: number, makerPrice: number) {
  return takerSide === "BUY" ? makerPrice <= takerPrice : makerPrice >= takerPrice;
}

export function sortByPriceTime<T extends Pick<MatchableOrder, "side" | "price" | "createdAt">>(
  takerSide: "BUY" | "SELL",
  orders: T[],
) {
  return [...orders].sort((a, b) => {
    const priceOrder = takerSide === "BUY" ? a.price - b.price : b.price - a.price;
    return priceOrder || a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function settlementAmounts(limitPrice: number, executionPrice: number, quantity: number) {
  const reservedCost = limitPrice * quantity;
  const executionCost = executionPrice * quantity;
  if (executionCost > reservedCost) throw new Error("Execution cannot exceed a buy order's limit");
  return { reservedCost, executionCost, refund: reservedCost - executionCost };
}
