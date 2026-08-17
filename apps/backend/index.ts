import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { prisma } from "db";
import { middleware } from "./middleware";
import { ApiError } from "./errors";
import { CancelOrderSchema, CreateOrderSchema, SplitMergeSchema, TransferSchema } from "./types";
import { cancelOrder, mergePosition, placeOrder, splitPosition } from "./trading";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const origins = (process.env.CORS_ORIGINS ?? "http://localhost:3001").split(",").map((value) => value.trim());

app.use(express.json({ limit: "32kb" }));
app.use(cors({ origin: origins, credentials: true }));

const route = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void handler(req, res).catch(next);

function parse<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", "Request data is invalid");
  return result.data;
}

type Level = { price: number; quantity: number; orderCount: number };
function bookFor(orders: { outcome: "YES" | "NO"; side: "BUY" | "SELL"; price: number; quantity: number; filledQuantity: number }[]) {
  const book = {
    YES: { bids: [] as Level[], asks: [] as Level[] },
    NO: { bids: [] as Level[], asks: [] as Level[] },
  };
  const levels = new Map<string, Level>();
  for (const order of orders) {
    const key = `${order.outcome}:${order.side}:${order.price}`;
    const current = levels.get(key) ?? { price: order.price, quantity: 0, orderCount: 0 };
    current.quantity += order.quantity - order.filledQuantity;
    current.orderCount += 1;
    levels.set(key, current);
  }
  for (const [key, level] of levels) {
    const [outcome, side] = key.split(":") as ["YES" | "NO", "BUY" | "SELL"];
    book[outcome][side === "BUY" ? "bids" : "asks"].push(level);
  }
  for (const outcome of ["YES", "NO"] as const) {
    book[outcome].bids.sort((a, b) => b.price - a.price);
    book[outcome].asks.sort((a, b) => a.price - b.price);
  }
  return book;
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/markets", route(async (_req, res) => {
  const markets = await prisma.market.findMany({
    include: { orders: { where: { status: { in: ["OPEN", "PARTIALLY_FILLED"] } }, select: { outcome: true, side: true, price: true, quantity: true, filledQuantity: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ markets: markets.map(({ orders, ...market }) => ({ ...market, orderBook: bookFor(orders) })) });
}));

app.get("/markets/:marketId", route(async (req, res) => {
  const market = await prisma.market.findUnique({
    where: { id: req.params.marketId },
    include: {
      orders: { where: { status: { in: ["OPEN", "PARTIALLY_FILLED"] } }, select: { outcome: true, side: true, price: true, quantity: true, filledQuantity: true } },
      trades: { take: 50, orderBy: { createdAt: "desc" } },
      resolution: true,
    },
  });
  if (!market) throw new ApiError(404, "NOT_FOUND", "Market not found");
  const { orders, ...data } = market;
  res.json({ market: { ...data, orderBook: bookFor(orders) } });
}));

app.post("/orders", middleware, route(async (req, res) => {
  const result = await placeOrder(req.userId, parse(CreateOrderSchema, req.body));
  res.status(201).json(result);
}));

app.post("/orders/:orderId/cancel", middleware, route(async (req, res) => {
  const { orderId } = parse(CancelOrderSchema, req.params);
  res.json({ order: await cancelOrder(req.userId, orderId) });
}));

app.get("/me", middleware, route(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { id: true, address: true, availableBalance: true, reservedBalance: true } });
  res.json({ user });
}));

app.get("/positions", middleware, route(async (req, res) => {
  const positions = await prisma.position.findMany({ where: { userId: req.userId }, include: { market: { select: { title: true, status: true } } }, orderBy: { updatedAt: "desc" } });
  res.json({ positions });
}));

app.get("/orders", middleware, route(async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.userId }, include: { market: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ orders });
}));

app.get("/activity", middleware, route(async (req, res) => {
  const entries = await prisma.ledgerEntry.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ entries });
}));

app.post("/split", middleware, route(async (req, res) => {
  const data = parse(SplitMergeSchema, req.body);
  res.json(await splitPosition(req.userId, data.marketId, data.quantity));
}));

app.post("/merge", middleware, route(async (req, res) => {
  const data = parse(SplitMergeSchema, req.body);
  res.json(await mergePosition(req.userId, data.marketId, data.quantity));
}));

async function transfer(userId: string, type: "DEPOSIT" | "WITHDRAWAL", amountInDollars: number) {
  const amount = Math.round(amountInDollars * 100);
  return prisma.$transaction(async (tx) => {
    if (type === "WITHDRAWAL") {
      const updated = await tx.user.updateMany({ where: { id: userId, availableBalance: { gte: amount } }, data: { availableBalance: { decrement: amount } } });
      if (!updated.count) throw new ApiError(409, "INSUFFICIENT_FUNDS", "Insufficient available balance");
    } else {
      await tx.user.update({ where: { id: userId }, data: { availableBalance: { increment: amount } } });
    }
    const record = await tx.transfer.create({ data: { userId, type, amount, status: "COMPLETED", completedAt: new Date() } });
    await tx.ledgerEntry.create({ data: { userId, transferId: record.id, asset: "CASH", availableDelta: type === "DEPOSIT" ? amount : -amount, reservedDelta: 0, reason: type } });
    return record;
  });
}

app.post("/deposits", middleware, route(async (req, res) => res.status(201).json({ transfer: await transfer(req.userId, "DEPOSIT", parse(TransferSchema, req.body).amount) })));
app.post("/withdrawals", middleware, route(async (req, res) => res.status(201).json({ transfer: await transfer(req.userId, "WITHDRAWAL", parse(TransferSchema, req.body).amount) })));

app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});

// Vercel imports this Express application and turns it into one Function.
// Local development still starts a normal long-running HTTP server.
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

export default app;
