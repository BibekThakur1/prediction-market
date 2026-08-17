import { Prisma, prisma } from "./database.js";
import { ApiError, assertFound } from "./errors.js";
import { pricesCross, remainingQuantity, settlementAmounts, statusAfterFill } from "./matching.js";
import type { CreateOrderInput } from "./types.js";

const openStatuses = ["OPEN", "PARTIALLY_FILLED"] as const;

type Tx = Prisma.TransactionClient;
type Outcome = "YES" | "NO";

async function serializable<T>(work: (tx: Tx) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string; meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } }).code;
      const postgresCode = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } }).meta?.driverAdapterError?.cause?.originalCode;
      if (attempt === 3 || (code !== "P2034" && postgresCode !== "40001" && postgresCode !== "40P01")) throw error;
    }
  }
  throw new Error("Transaction retry limit reached");
}

function assetFor(outcome: Outcome) {
  return outcome;
}

async function position(tx: Tx, userId: string, marketId: string, outcome: Outcome) {
  return tx.position.upsert({
    where: { userId_marketId_outcome: { userId, marketId, outcome } },
    create: { userId, marketId, outcome },
    update: {},
  });
}

async function reserveOrder(tx: Tx, userId: string, orderId: string, input: CreateOrderInput) {
  if (input.side === "BUY") {
    const amount = input.price * input.quantity;
    const updated = await tx.user.updateMany({
      where: { id: userId, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount }, reservedBalance: { increment: amount } },
    });
    if (!updated.count) throw new ApiError(409, "INSUFFICIENT_FUNDS", "Insufficient available balance");
    await tx.ledgerEntry.create({
      data: { userId, marketId: input.marketId, orderId, asset: "CASH", availableDelta: -amount, reservedDelta: amount, reason: "ORDER_RESERVE" },
    });
    return;
  }

  await position(tx, userId, input.marketId, input.outcome);
  const updated = await tx.position.updateMany({
    where: { userId, marketId: input.marketId, outcome: input.outcome, availableQty: { gte: input.quantity } },
    data: { availableQty: { decrement: input.quantity }, reservedQty: { increment: input.quantity } },
  });
  if (!updated.count) throw new ApiError(409, "INSUFFICIENT_POSITION", `Insufficient available ${input.outcome} shares`);
  await tx.ledgerEntry.create({
    data: { userId, marketId: input.marketId, orderId, asset: assetFor(input.outcome), availableDelta: -input.quantity, reservedDelta: input.quantity, reason: "ORDER_RESERVE" },
  });
}

async function settleFill(tx: Tx, args: {
  marketId: string;
  outcome: Outcome;
  price: number;
  quantity: number;
  buyerId: string;
  sellerId: string;
  buyOrderId: string;
  buyLimitPrice: number;
  sellOrderId: string;
  tradeId: string;
}) {
  const { reservedCost, executionCost, refund } = settlementAmounts(args.buyLimitPrice, args.price, args.quantity);

  await tx.user.update({
    where: { id: args.buyerId },
    data: { reservedBalance: { decrement: reservedCost }, availableBalance: { increment: refund } },
  });
  await tx.user.update({
    where: { id: args.sellerId },
    data: { availableBalance: { increment: executionCost } },
  });
  await position(tx, args.buyerId, args.marketId, args.outcome);
  await tx.position.update({
    where: { userId_marketId_outcome: { userId: args.buyerId, marketId: args.marketId, outcome: args.outcome } },
    data: { availableQty: { increment: args.quantity } },
  });
  await tx.position.update({
    where: { userId_marketId_outcome: { userId: args.sellerId, marketId: args.marketId, outcome: args.outcome } },
    data: { reservedQty: { decrement: args.quantity } },
  });

  await tx.ledgerEntry.createMany({ data: [
    { userId: args.buyerId, marketId: args.marketId, orderId: args.buyOrderId, tradeId: args.tradeId, asset: "CASH", availableDelta: refund, reservedDelta: -reservedCost, reason: "TRADE_SETTLEMENT" },
    { userId: args.sellerId, marketId: args.marketId, orderId: args.sellOrderId, tradeId: args.tradeId, asset: "CASH", availableDelta: executionCost, reservedDelta: 0, reason: "TRADE_SETTLEMENT" },
    { userId: args.buyerId, marketId: args.marketId, orderId: args.buyOrderId, tradeId: args.tradeId, asset: assetFor(args.outcome), availableDelta: args.quantity, reservedDelta: 0, reason: "TRADE_SETTLEMENT" },
    { userId: args.sellerId, marketId: args.marketId, orderId: args.sellOrderId, tradeId: args.tradeId, asset: assetFor(args.outcome), availableDelta: 0, reservedDelta: -args.quantity, reason: "TRADE_SETTLEMENT" },
  ] });
}

export async function placeOrder(userId: string, input: CreateOrderInput) {
  return serializable(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status::text FROM "Market" WHERE id = ${input.marketId} FOR UPDATE
    `;
    const market = assertFound(locked[0], "Market not found");
    if (market.status !== "OPEN") throw new ApiError(409, "MARKET_NOT_OPEN", "Market is not open for trading");
    assertFound(await tx.user.findUnique({ where: { id: userId } }), "User not found");

    const order = await tx.order.create({ data: { userId, ...input } });
    await reserveOrder(tx, userId, order.id, input);

    const makers = await tx.order.findMany({
      where: {
        marketId: input.marketId,
        outcome: input.outcome,
        side: input.side === "BUY" ? "SELL" : "BUY",
        userId: { not: userId },
        status: { in: [...openStatuses] },
        ...(input.side === "BUY" ? { price: { lte: input.price } } : { price: { gte: input.price } }),
      },
      orderBy: input.side === "BUY"
        ? [{ price: "asc" }, { createdAt: "asc" }]
        : [{ price: "desc" }, { createdAt: "asc" }],
    });

    let filledQuantity = 0;
    const trades = [];
    for (const maker of makers) {
      if (filledQuantity >= input.quantity || !pricesCross(input.side, input.price, maker.price)) break;
      const quantity = Math.min(input.quantity - filledQuantity, remainingQuantity(maker));
      if (quantity <= 0) continue;
      const buyerId = input.side === "BUY" ? userId : maker.userId;
      const sellerId = input.side === "SELL" ? userId : maker.userId;
      const buyOrder = input.side === "BUY" ? order : maker;
      const sellOrder = input.side === "SELL" ? order : maker;
      const trade = await tx.trade.create({ data: {
        marketId: input.marketId,
        outcome: input.outcome,
        price: maker.price,
        quantity,
        buyerId,
        sellerId,
        makerOrderId: maker.id,
        takerOrderId: order.id,
      } });
      await settleFill(tx, {
        marketId: input.marketId,
        outcome: input.outcome,
        price: maker.price,
        quantity,
        buyerId,
        sellerId,
        buyOrderId: buyOrder.id,
        buyLimitPrice: buyOrder.price,
        sellOrderId: sellOrder.id,
        tradeId: trade.id,
      });
      const makerFilled = maker.filledQuantity + quantity;
      await tx.order.update({ where: { id: maker.id }, data: { filledQuantity: makerFilled, status: statusAfterFill(maker.quantity, makerFilled) } });
      filledQuantity += quantity;
      trades.push(trade);
    }

    const finalOrder = await tx.order.update({
      where: { id: order.id },
      data: { filledQuantity, status: statusAfterFill(order.quantity, filledQuantity) },
    });
    return { order: finalOrder, trades };
  });
}

export async function cancelOrder(userId: string, orderId: string) {
  return serializable(async (tx) => {
    const candidate = assertFound(await tx.order.findUnique({ where: { id: orderId }, select: { marketId: true } }), "Order not found");
    await tx.$queryRaw`SELECT id FROM "Market" WHERE id = ${candidate.marketId} FOR UPDATE`;
    const order = assertFound(await tx.order.findUnique({ where: { id: orderId } }), "Order not found");
    if (order.userId !== userId) throw new ApiError(403, "FORBIDDEN", "You cannot cancel this order");
    if (!openStatuses.includes(order.status as typeof openStatuses[number])) throw new ApiError(409, "ORDER_NOT_OPEN", "Order is no longer open");
    const remaining = remainingQuantity(order);
    if (order.side === "BUY") {
      const amount = remaining * order.price;
      await tx.user.update({ where: { id: userId }, data: { availableBalance: { increment: amount }, reservedBalance: { decrement: amount } } });
      await tx.ledgerEntry.create({ data: { userId, marketId: order.marketId, orderId, asset: "CASH", availableDelta: amount, reservedDelta: -amount, reason: "ORDER_RELEASE" } });
    } else {
      await tx.position.update({
        where: { userId_marketId_outcome: { userId, marketId: order.marketId, outcome: order.outcome } },
        data: { availableQty: { increment: remaining }, reservedQty: { decrement: remaining } },
      });
      await tx.ledgerEntry.create({ data: { userId, marketId: order.marketId, orderId, asset: assetFor(order.outcome), availableDelta: remaining, reservedDelta: -remaining, reason: "ORDER_RELEASE" } });
    }
    return tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  });
}

export async function splitPosition(userId: string, marketId: string, quantity: number) {
  const cost = quantity * 100;
  return prisma.$transaction(async (tx) => {
    const market = assertFound(await tx.market.findUnique({ where: { id: marketId } }), "Market not found");
    if (market.status !== "OPEN") throw new ApiError(409, "MARKET_NOT_OPEN", "Market is not open");
    const updated = await tx.user.updateMany({ where: { id: userId, availableBalance: { gte: cost } }, data: { availableBalance: { decrement: cost } } });
    if (!updated.count) throw new ApiError(409, "INSUFFICIENT_FUNDS", "Insufficient available balance");
    for (const outcome of ["YES", "NO"] as const) {
      await tx.position.upsert({
        where: { userId_marketId_outcome: { userId, marketId, outcome } },
        create: { userId, marketId, outcome, availableQty: quantity },
        update: { availableQty: { increment: quantity } },
      });
    }
    await tx.ledgerEntry.createMany({ data: [
      { userId, marketId, asset: "CASH", availableDelta: -cost, reservedDelta: 0, reason: "SPLIT" },
      { userId, marketId, asset: "YES", availableDelta: quantity, reservedDelta: 0, reason: "SPLIT" },
      { userId, marketId, asset: "NO", availableDelta: quantity, reservedDelta: 0, reason: "SPLIT" },
    ] });
    return { quantity, cost };
  });
}

export async function mergePosition(userId: string, marketId: string, quantity: number) {
  const proceeds = quantity * 100;
  return prisma.$transaction(async (tx) => {
    for (const outcome of ["YES", "NO"] as const) {
      const updated = await tx.position.updateMany({
        where: { userId, marketId, outcome, availableQty: { gte: quantity } },
        data: { availableQty: { decrement: quantity } },
      });
      if (!updated.count) throw new ApiError(409, "INSUFFICIENT_POSITION", `Insufficient available ${outcome} shares`);
    }
    await tx.user.update({ where: { id: userId }, data: { availableBalance: { increment: proceeds } } });
    await tx.ledgerEntry.createMany({ data: [
      { userId, marketId, asset: "CASH", availableDelta: proceeds, reservedDelta: 0, reason: "MERGE" },
      { userId, marketId, asset: "YES", availableDelta: -quantity, reservedDelta: 0, reason: "MERGE" },
      { userId, marketId, asset: "NO", availableDelta: -quantity, reservedDelta: 0, reason: "MERGE" },
    ] });
    return { quantity, proceeds };
  });
}
