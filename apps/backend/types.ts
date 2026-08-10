import z from "zod";

const positiveInt = z.coerce.number().int().positive();

export const CreateOrderSchema = z.object({
  marketId: z.string().uuid(),
  outcome: z.enum(["YES", "NO"]),
  side: z.enum(["BUY", "SELL"]),
  price: positiveInt.max(99),
  quantity: positiveInt.max(1_000_000),
});

export const CancelOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const SplitMergeSchema = z.object({
  marketId: z.string().uuid(),
  quantity: positiveInt.max(1_000_000),
});

export const TransferSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
