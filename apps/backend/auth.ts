import { createClient } from "@supabase/supabase-js";
import { prisma } from "./database";
import type { NextFunction, Request, Response } from "express";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let client: ReturnType<typeof createClient> | undefined;
function supabase() {
  client ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"));
  return client;
}

export async function middleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
    if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in to continue" } });

    const { data: { user }, error } = await supabase().auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session is invalid or expired" } });
    const address = user.user_metadata?.custom_claims?.address ?? user.user_metadata?.address ?? user.id;
    const startingBalance = Number(process.env.TESTNET_STARTING_BALANCE_CENTS ?? 10_000);

    const userDb = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${address}))`;
      const existing = await tx.user.findUnique({ where: { address } });
      if (existing) return existing;
      const created = await tx.user.create({ data: { address, availableBalance: startingBalance } });
      if (startingBalance > 0) {
        const transfer = await tx.transfer.create({ data: {
          userId: created.id,
          type: "DEPOSIT",
          amount: startingBalance,
          status: "COMPLETED",
          completedAt: new Date(),
          externalRef: `signup:${user.id}`,
        } });
        await tx.ledgerEntry.create({ data: {
          userId: created.id,
          transferId: transfer.id,
          asset: "CASH",
          availableDelta: startingBalance,
          reservedDelta: 0,
          reason: "DEPOSIT",
        } });
      }
      return created;
    });
    req.userId = userDb.id;
    next();
  } catch (error) {
    next(error);
  }
}
