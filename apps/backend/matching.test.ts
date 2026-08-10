import { describe, expect, test } from "bun:test";
import { pricesCross, remainingQuantity, settlementAmounts, sortByPriceTime, statusAfterFill } from "./matching";

describe("matching rules", () => {
  test("uses best price, then earliest order", () => {
    const late = new Date("2026-01-01T00:00:02Z"), early = new Date("2026-01-01T00:00:01Z");
    const orders = [
      { side: "SELL" as const, price: 55, createdAt: late },
      { side: "SELL" as const, price: 54, createdAt: late },
      { side: "SELL" as const, price: 55, createdAt: early },
    ];
    expect(sortByPriceTime("BUY", orders).map((order) => [order.price, order.createdAt])).toEqual([
      [54, late], [55, early], [55, late],
    ]);
  });

  test("enforces both sides of a limit", () => {
    expect(pricesCross("BUY", 60, 60)).toBe(true);
    expect(pricesCross("BUY", 60, 61)).toBe(false);
    expect(pricesCross("SELL", 40, 40)).toBe(true);
    expect(pricesCross("SELL", 40, 39)).toBe(false);
  });

  test("tracks partial and complete fills", () => {
    expect(remainingQuantity({ quantity: 10, filledQuantity: 4 })).toBe(6);
    expect(statusAfterFill(10, 0)).toBe("OPEN");
    expect(statusAfterFill(10, 4)).toBe("PARTIALLY_FILLED");
    expect(statusAfterFill(10, 10)).toBe("FILLED");
  });

  test("refunds price improvement without creating cash", () => {
    const result = settlementAmounts(65, 60, 10);
    expect(result).toEqual({ reservedCost: 650, executionCost: 600, refund: 50 });
    expect(result.executionCost + result.refund).toBe(result.reservedCost);
  });
});
